"use client";

import React, { Fragment } from 'react';

type RichTextNode = {
    type?: string;
    text?: string;
    children?: RichTextNode[];
    format?: number;
    [key: string]: any;
};

interface SerializeRichTextProps {
    content: any;
    className?: string;
    boldClassName?: string;
    boldStyle?: React.CSSProperties;
    disableParagraphs?: boolean;
}

const IS_BOLD = 1;

export const SerializeRichText: React.FC<SerializeRichTextProps> = ({
    content,
    className,
    boldClassName,
    boldStyle,
    disableParagraphs,
}) => {
    if (!content || !content.root || !content.root.children) {
        return null;
    }

    const serialize = (nodes: RichTextNode[]): React.ReactNode[] => {
        return nodes.map((node, i) => {
            if (node.type === 'text') {
                if ((node.format as number) & IS_BOLD) {
                    return (
                        <span key={i} className={boldClassName} style={boldStyle}>
                            {node.text}
                        </span>
                    );
                }
                const lines = (node.text || '').split('\n');
                return (
                    <span key={i}>
                        {lines.map((line, lineIndex) => (
                            <Fragment key={`${i}-${lineIndex}`}>
                                {line}
                                {lineIndex < lines.length - 1 ? <br /> : null}
                            </Fragment>
                        ))}
                    </span>
                );
            }

            if (!node) return null;

            if (node.type === 'paragraph') {
                if (disableParagraphs) {
                    return <Fragment key={i}>{serialize(node.children || [])}</Fragment>;
                }
                return <p key={i}>{serialize(node.children || [])}</p>;
            }

            return <Fragment key={i}>{serialize(node.children || [])}</Fragment>;
        });
    };

    return (
        <span className={className}>
            {serialize(content.root.children)}
        </span>
    );
};
