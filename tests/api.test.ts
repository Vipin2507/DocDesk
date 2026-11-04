import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { createUser, openDatabase, type DB } from "../server/db";

let db: DB;
let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "doc-studio-"));
  process.env.DATA_DIR = directory;
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_PASSWORD = "";
  db = openDatabase(":memory:");
  createUser(db, { email: "admin@buildesk.local", name: "Asha Admin", password: "password123", role: "admin" });
  createUser(db, { email: "view@buildesk.local", name: "Vikram Viewer", password: "password123", role: "viewer" });
});

afterEach(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function signIn(email: string) {
  const agent = request.agent(createApp(db));
  await agent.post("/api/auth/login").send({ email, password: "password123" }).expect(200);
  return agent;
}

describe("authorization and templates", () => {
  it("rejects a bad password and hides templates from anonymous users", async () => {
    const app = createApp(db);
    await request(app).post("/api/auth/login").send({ email: "admin@buildesk.local", password: "nope" }).expect(401);
    await request(app).get("/api/document-studio/templates").expect(401);
  });

  it("imports PDFMake JSON, saves a version, and restores it", async () => {
    const agent = await signIn("admin@buildesk.local");
    const uploaded = await agent
      .post("/api/document-studio/upload")
      .attach("file", Buffer.from(JSON.stringify({ pageSize: "A4", content: [{ text: "Invoice Number: INV-14" }, { text: "Customer Name: Vipin Tomar" }] })), "invoice.json")
      .expect(201);
    expect(uploaded.body.classification).toBe("pdfmake");
    const converted = await agent.post("/api/document-studio/convert").send({ uploadId: uploaded.body.uploadId, mode: "json" }).expect(200);
    const id = converted.body.template.id as string;
    expect(converted.body.template.variables.some((variable: { id: string }) => variable.id === "customer_name")).toBe(true);

    await agent
      .put(`/api/document-studio/templates/${id}`)
      .send({
        name: "Invoice",
        category: "Invoices",
        status: "active",
        documentDefinition: converted.body.template.documentDefinition,
        variables: converted.body.template.variables,
      })
      .expect(200);
    const renamed = await agent
      .put(`/api/document-studio/templates/${id}`)
      .send({
        name: "Invoice revised",
        documentDefinition: {
          ...converted.body.template.documentDefinition,
          content: [...converted.body.template.documentDefinition.content, { text: "Note: {{customer_name}}" }],
        },
        variables: converted.body.template.variables,
      })
      .expect(200);
    expect(renamed.body.template.version).toBeGreaterThan(1);
    const history = await agent.get(`/api/document-studio/templates/${id}/versions`).expect(200);
    expect(history.body.versions.length).toBeGreaterThan(1);
    const restored = await agent.post(`/api/document-studio/templates/${id}/restore`).send({ versionNumber: 1 }).expect(200);
    expect(restored.body.template.version).toBeGreaterThan(renamed.body.template.version);

    const duplicate = await agent.post(`/api/document-studio/templates/${id}/duplicate`).expect(201);
    expect(duplicate.body.template.name).toMatch(/Copy of/);
    const viewer = await signIn("view@buildesk.local");
    await viewer.delete(`/api/document-studio/templates/${id}`).expect(403);
    await agent.delete(`/api/document-studio/templates/${id}`).expect(200);
  });

  it("rejects an invalid file, a script, and reports generic JSON", async () => {
    const agent = await signIn("admin@buildesk.local");
    const badPdf = await agent
      .post("/api/document-studio/upload")
      .attach("file", Buffer.from("hello"), { filename: "bad.pdf", contentType: "application/pdf" });
    expect(badPdf.status).toBe(400);
    const script = await agent.post("/api/document-studio/upload").attach("file", Buffer.from("var dd = { content: [] };"), "letter.json");
    expect(script.status).toBe(400);
    expect(script.body.error.message).toMatch(/never executes JavaScript/i);
    const generic = await agent
      .post("/api/document-studio/upload")
      .attach("file", Buffer.from(JSON.stringify({ employee: { name: "John" } })), "employee.json")
      .expect(201);
    expect(generic.body.classification).toBe("generic");
    const imported = await agent.post("/api/document-studio/convert").send({ uploadId: generic.body.uploadId, mode: "generic" }).expect(200);
    expect(JSON.stringify(imported.body.template.documentDefinition)).toContain("employee.name");
  });

  it("generates a PDF download from filled variables", async () => {
    const agent = await signIn("admin@buildesk.local");
    const created = await agent.post("/api/document-studio/templates").send({ name: "Demand Letter", category: "Demand Letters" }).expect(201);
    const template = created.body.template;
    template.documentDefinition = {
      pageSize: "A4",
      content: [{ text: "Customer Name: {{customer_name}}" }, { text: "Total Amount: ₹{{total_amount}}" }],
    };
    template.variables = [
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "", required: true, group: "Customer Details", order: 0, bindings: [] },
      { id: "total_amount", label: "Total Amount", type: "currency", defaultValue: 0, required: true, group: "Financial Details", order: 1, bindings: [] },
    ];
    const generated = await agent.post("/api/document-studio/generate").send({
      templateId: template.id,
      templateName: "Demand Letter",
      documentDefinition: template.documentDefinition,
      variables: template.variables,
      values: { customer_name: "Vipin Tomar", total_amount: 50000 },
      save: true,
    }).expect(200);
    expect(generated.body.fileName).toContain("Vipin_Tomar");
    const file = await agent.get(`/api/document-studio/generated/${generated.body.id}/file`).expect(200);
    expect(file.headers["content-type"]).toContain("pdf");
    expect(file.body.subarray(0, 4).toString()).toBe("%PDF");
    const missing = await agent.post("/api/document-studio/generate").send({
      templateId: template.id,
      templateName: "Demand Letter",
      documentDefinition: template.documentDefinition,
      variables: template.variables,
      values: { customer_name: "", total_amount: 10 },
    });
    expect(missing.status).toBe(422);
  });

  it("saves a master and creates a document from it without changing the master", async () => {
    const agent = await signIn("admin@buildesk.local");
    const saved = await agent
      .post("/api/document-studio/masters")
      .send({
        name: "Demand letter",
        category: "Demand Letters",
        json: JSON.stringify({
          pageSize: "A4",
          content: [{ text: "Customer Name: Vipin Tomar" }, { text: "Amount: ₹50000" }],
        }),
      })
      .expect(201);
    expect(saved.body.master.variables.some((variable: { id: string }) => variable.id === "customer_name")).toBe(true);
    const listed = await agent.get("/api/document-studio/masters").expect(200);
    expect(listed.body.items).toHaveLength(1);
    const created = await agent.post(`/api/document-studio/masters/${saved.body.master.id}/use`).expect(201);
    expect(created.body.template.name).toBe("Demand letter");
    expect(created.body.template.description).toMatch(/Created from master/);
    const viewer = await signIn("view@buildesk.local");
    await viewer.post(`/api/document-studio/masters/${saved.body.master.id}/use`).expect(403);
    await viewer.delete(`/api/document-studio/masters/${saved.body.master.id}`).expect(403);
    await agent.delete(`/api/document-studio/masters/${saved.body.master.id}`).expect(200);
  });
});
