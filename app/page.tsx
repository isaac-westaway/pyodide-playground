"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { placeholder1, placeholder2, placeholder3, placeholder4, placeholder5, placeholder6, placeholder7 } from "./placeholders"
import { captureCode } from "./python"
import { createHtmlReactComponent } from "./hoc"
import type { PyProxy } from "pyodide/ffi"

interface Pyodide {
    runPython: (code: string, opts?: { globals?: PyProxy }) => unknown
    runPythonAsync: (code: string, opts?: { globals?: PyProxy }) => Promise<unknown>
    loadPackage: (pkg: string) => Promise<void>
    globals: PyProxy
}

type Cell = {
    id: string
    code: string
    textOutput?: string
    HtmlReactComponent?: React.FC | null
}

declare global {
    interface Window {
        loadPyodide: ({ indexURL }: { indexURL: string }) => Promise<Pyodide>
    }
}

function generateId() {
    return Math.random().toString(36).slice(2)
}

const AVAILABLE_LIBRARIES = [
    { name: "numpy", pyodide: "numpy" },
    { name: "matplotlib", pyodide: "matplotlib" },
    { name: "scikit-learn", pyodide: "scikit-learn" },
    { name: "pandas", pyodide: "pandas" },
    { name: "scipy", pyodide: "scipy" },
    { name: "sympy", pyodide: "sympy" },
    { name: "requests", pyodide: "micropip" },
]

export default function PythonNotebook() {
    const [cells, setCells] = useState<Cell[]>([
        { id: generateId(), code: placeholder1, textOutput: "", HtmlReactComponent: null },
        { id: generateId(), code: placeholder2, textOutput: "", HtmlReactComponent: null },
        { id: generateId(), code: placeholder3, textOutput: "", HtmlReactComponent: null },
        { id: generateId(), code: placeholder4, textOutput: "", HtmlReactComponent: null },
        { id: generateId(), code: placeholder5, textOutput: "", HtmlReactComponent: null},
        { id: generateId(), code: placeholder6, textOutput: "", HtmlReactComponent: null },
        { id: generateId(), code: placeholder7, textOutput: "", HtmlReactComponent: null },
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [pyodideReady, setPyodideReady] = useState(false)
    const pyodideRef = useRef<Pyodide | null>(null)
    const [selectedLibs, setSelectedLibs] = useState<string[]>([])

    useEffect(() => {
        initializePyodide()
    }, [])

    const ensurePackages = async () => {
        if (!pyodideRef.current) return
        const pyodide = pyodideRef.current
        for (const lib of selectedLibs) {
            try {
                await pyodide.loadPackage(lib)
            } catch (e) {
                console.error(`Failed to load package ${lib}:`, e)
            }
        }
    }

    const initializePyodide = async () => {
        setIsLoading(true)
        if (typeof window.loadPyodide !== "function") {
            await new Promise((resolve, reject) => {
                const script = document.createElement("script")
                script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"
                script.async = true
                script.onload = resolve
                script.onerror = reject
                document.head.appendChild(script)
            })
        }

        const pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
        })

        // Create a shared globals scope to persist variables/functions
        pyodide.globals.set("__notebook_globals__", pyodide.globals)

        pyodideRef.current = pyodide
        setPyodideReady(true)
        setIsLoading(false)
    }

    const runCell = async (cellIdx: number) => {
        if (!pyodideRef.current || !pyodideReady) return
        setIsLoading(true)
        const pyodide = pyodideRef.current

        await ensurePackages()

        let output = ""
        const jsonOutput: { text: string; html: string } = { text: "", html: "" }

        const code = cells[cellIdx].code

        try {
            const capturedCode = captureCode(code);

            const result = await pyodide.runPythonAsync(capturedCode, { globals: pyodide.globals })

            output = String(result)

            console.log("Captured output:", output)

            const parsedOutput = JSON.parse(output)
            if (parsedOutput.text !== '') jsonOutput.text = parsedOutput.text
            if (parsedOutput.html !== '') jsonOutput.html = parsedOutput.html

            console.log("Parsed Text output:", jsonOutput.text)
            console.log("Parsed HTML output:", jsonOutput.html)

            console.log("Parsed JSON output:", JSON.parse(output))
        } catch (err: unknown) {
            output = "Python Error: " + (err?.toString?.() || "Unknown error")
        }

        const isEmptyText = jsonOutput.text === ""
        const isEmptyHtml = jsonOutput.html === ""

        console.log("Is empty text:", isEmptyText)
        console.log("Is empty HTML:", isEmptyHtml)

        if (!isEmptyText && isEmptyHtml) output = jsonOutput.text
        else if (isEmptyText && !isEmptyHtml) output = jsonOutput.html
        else if (isEmptyText && isEmptyHtml) output = ""
        const HtmlReactComponent = jsonOutput.html
            ? createHtmlReactComponent(jsonOutput.html)
            : null;

        setCells(cells =>
            cells.map((cell, idx) =>
                idx === cellIdx
                    ? { ...cell, textOutput: jsonOutput.text, HtmlReactComponent }
                    : cell
            )
        )
        setIsLoading(false)
    }

    const addCell = (idx: number) => {
        setCells(cells => [
            ...cells.slice(0, idx + 1),
            { id: generateId(), code: "", output: "" },
            ...cells.slice(idx + 1)
        ])
    }

    const removeCell = (idx: number) => {
        if (cells.length === 1) return
        setCells(cells => cells.filter((_, i) => i !== idx))
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Python Notebook (Persistent Kernel)</CardTitle>
                        <p className="text-sm text-gray-600">Run cells with shared namespace, just like JupyterLab</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block mb-1 font-medium">Add libraries:</label>
                            <select
                                multiple
                                className="border rounded p-2 w-full"
                                value={selectedLibs}
                                onChange={e => {
                                    const options = Array.from(e.target.selectedOptions).map(o => o.value)
                                    setSelectedLibs(options)
                                }}
                                disabled={isLoading}
                            >
                                {AVAILABLE_LIBRARIES.map(lib => (
                                    <option key={lib.name} value={lib.pyodide}>
                                        {lib.name}
                                    </option>
                                ))}
                            </select>
                            <div className="text-xs text-gray-500 mt-1">Hold Ctrl (Windows) or Cmd (Mac) to select multiple.</div>
                        </div>

                        {cells.map((cell, idx) => (
                            <div key={cell.id} className="mb-6 border rounded p-3 bg-white">
                                <div className="flex gap-2 mb-2">
                                    <Button size="sm" onClick={() => runCell(idx)} disabled={isLoading || !pyodideReady}>
                                        Run
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => addCell(idx)} disabled={isLoading}>
                                        + Cell
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => removeCell(idx)} disabled={cells.length === 1}>
                                        Delete
                                    </Button>
                                </div>
                                <textarea
                                    spellCheck="false"
                                    className="w-full h-56 p-2 border border-gray-300 rounded font-mono text-sm resize-y"
                                    value={cell.code}
                                    onChange={e => {
                                        const code = e.target.value
                                        setCells(cells =>
                                            cells.map((c, i) => i === idx ? { ...c, code } : c)
                                        )
                                    }}
                                    disabled={isLoading}
                                />
                                {cell.textOutput && (
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap">
                                        {cell.textOutput}
                                    </pre>
                                )}
                                {cell.HtmlReactComponent && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap">
                                        <cell.HtmlReactComponent />
                                    </div>
                                )}
                            </div>
                        ))}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>status: {pyodideReady ? "✅ Pyodide Ready" : "⏳ Loading Pyodide..."}</span>
                            <span>shared namespace active</span>
                        </div>
                    </CardContent>
                </Card>
                {/* <TestComponent /> */}
            </div>
        </div>
    )
}
