"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function BriefBody({ markdown }: { markdown: string }) {
  return (
    <div className="brief-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
