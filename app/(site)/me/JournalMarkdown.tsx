import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function JournalMarkdown({ content }: { content: string }) {
  return (
    <div className="journal-markdown prose-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
