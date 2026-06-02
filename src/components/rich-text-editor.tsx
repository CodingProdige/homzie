"use client";

import { type ClipboardEvent, type ReactNode, useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

import { cn } from "@/lib/utils";

const richTextBlockTags = /<\/?(p|div|br|li|ul|ol|h[1-6])[^>]*>/gi;
const richTextAllTags = /<[^>]+>/g;

export function richTextToPlainText(value: string) {
  return value
    .replace(richTextBlockTags, "\n")
    .replace(richTextAllTags, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function RichTextEditor({
  className,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  className?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || document.activeElement === editor) return;

    editor.innerHTML = value ? valueToEditorHtml(value) : "";
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;

    if (!editor) return;

    onChange(normalizeEditorHtml(editor.innerHTML));
  }

  function runCommand(command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList") {
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const pastedText = event.clipboardData.getData("text/plain");

    if (!editor || !pastedText) return;

    event.preventDefault();

    const currentText = richTextToPlainText(editor.innerHTML);
    const selectedText = String(window.getSelection()?.toString() || "");
    const remaining =
      typeof maxLength === "number"
        ? Math.max(maxLength - currentText.length + selectedText.length, 0)
        : pastedText.length;

    document.execCommand("insertText", false, pastedText.slice(0, remaining));
    emitChange();
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-background transition-colors focus-within:border-primary",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border bg-muted/35 px-2 py-2">
        <EditorButton label="Bold" onClick={() => runCommand("bold")}>
          <Bold className="size-4" />
        </EditorButton>
        <EditorButton label="Italic" onClick={() => runCommand("italic")}>
          <Italic className="size-4" />
        </EditorButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <EditorButton
          label="Bulleted list"
          onClick={() => runCommand("insertUnorderedList")}
        >
          <List className="size-4" />
        </EditorButton>
        <EditorButton
          label="Numbered list"
          onClick={() => runCommand("insertOrderedList")}
        >
          <ListOrdered className="size-4" />
        </EditorButton>
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          className="rich-text-editor min-h-40 w-full px-4 py-3 text-sm font-semibold leading-6 outline-none"
          contentEditable
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={emitChange}
          onPaste={handlePaste}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

function EditorButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function valueToEditorHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) {
    return normalizeEditorHtml(value);
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function normalizeEditorHtml(value: string) {
  const container = document.createElement("div");
  container.innerHTML = value;
  normalizeNode(container);

  return container.innerHTML
    .replace(/<div>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>")
    .replace(/<b>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>")
    .replace(/<i>/gi, "<em>")
    .replace(/<\/i>/gi, "</em>")
    .trim();
}

function normalizeNode(node: Node) {
  const allowedTags = new Set(["BR", "EM", "LI", "OL", "P", "STRONG", "UL"]);

  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement;

      normalizeNode(element);

      if (element.tagName === "B") {
        replaceElement(element, "strong");
        return;
      }

      if (element.tagName === "I") {
        replaceElement(element, "em");
        return;
      }

      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }

      Array.from(element.attributes).forEach((attribute) =>
        element.removeAttribute(attribute.name),
      );
    }
  });
}

function replaceElement(element: HTMLElement, tagName: "em" | "strong") {
  const replacement = document.createElement(tagName);

  replacement.append(...Array.from(element.childNodes));
  element.replaceWith(replacement);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
