import Editor from "@monaco-editor/react";

export function JsonEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Editor
      height="100%"
      language="json"
      theme="vs"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        formatOnPaste: true,
        tabSize: 2,
      }}
    />
  );
}
