import React from "react"

export function createHtmlReactComponent(html: string): React.FC {
    return function HtmlComponent() {
        return (
            <div
                // scary html, but we trust matplotlib
                dangerouslySetInnerHTML={{ __html: html }}
            />
        )
    }
}