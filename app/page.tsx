"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { placeholder1, placeholder2, placeholder3, placeholder4 } from "./placeholders"

interface Pyodide {
    runPython: (code: string) => unknown
    runPythonAsync: (code: string, opts?: { globals?: Record<string, unknown> }) => Promise<unknown>
    loadPackage: (pkg: string) => Promise<void>
    globals: Record<string, unknown>
}

type Cell = {
    id: string
    code: string
    output: string
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
    // { name: "pytorch", pyodide: "torch" }, // pytorch is NOT supported due to the huge wasmbinary size and extensive c++ backend
]

// Todos:
// implement a way so that only changed cells are re-ran when running a cell and re-running all previous cells
// also implement a way to run all cels at once, sequentially
// also implement a way so that an error in cell previous does not block execution of cell subsequent
// implement MIME types to support rich outputs like images, HTML
// also rich inputs like sliders, which can be access in python as a widget
// also a c++ one similar to this, as jupyterlab exposes a c++ kernel called xeus-cling // but this will be done in a different project
// also add a way to output return values, instead of having to always print
// also add a way to import an ipynb file, and convert it to this format, and vice versa
// also add a way to export the current notebook to an ipynb file
// also add a way to cache the notebook in local storage, so that it can be reloaded later

// we wil not support markdown cells, as this is a poc, and markdown cells and latex is already existing in our main app
export default function PythonNotebook() {
    const [cells, setCells] = useState<Cell[]>([
        { id: generateId(), code: placeholder1, output: "" },
        { id: generateId(), code: placeholder2, output: "" },
        { id: generateId(), code: placeholder3, output: "" },
        { id: generateId(), code: placeholder4, output: "" }
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
                // Optionally handle errors
            }
        }
    }

    const initializePyodide = async () => {
        setIsLoading(true)
        setPyodideReady(false)
        setTimeout(async () => {
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
            pyodideRef.current = pyodide
            setPyodideReady(true)
            setIsLoading(false)
        }, 100)
    }

    const runCell = async (cellIdx: number) => {
        if (!pyodideRef.current || !pyodideReady) return
        setIsLoading(true)
        const pyodide = pyodideRef.current

        await ensurePackages();

        // this is how jupyterlab does it
        pyodide.runPython(`
import sys
import builtins
for k in list(globals().keys()):
    if k not in ['__name__', '__doc__', '__package__', '__loader__', '__spec__', '__builtins__']:
        del globals()[k]
`)

        let output = ""
        for (let i = 0; i <= cellIdx; i++) {
            const code = cells[i].code
            try {
                const captureCode = `
import sys
import io
from contextlib import redirect_stdout

captured_output = io.StringIO()
with redirect_stdout(captured_output):
${code
                        .split("\n")
                        .map((line) => (line.trim() === "" ? "" : "    " + line))
                        .join("\n")}

output_value = captured_output.getvalue()
output_value
`
                output = String(await pyodide.runPythonAsync(captureCode, { globals: pyodide.globals }))
            } catch (err: unknown) {
                output = "Python Error: " + (err?.toString?.() ?? "Unknown error")
                break
            }
        }
        setCells(cells =>
            cells.map((cell, idx) =>
                idx === cellIdx ? { ...cell, output } : cell
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
                        <CardTitle>Jupyter-like python notebook (Pyodide)</CardTitle>
                        <p className="text-sm text-gray-600">add, edit, and run cells in browser memory</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="mb-4">
                            <label className="block mb-1 font-medium">add libraries:</label>
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
                                    className="w-full h-24 p-2 border border-gray-300 rounded font-mono text-sm resize-y"
                                    value={cell.code}
                                    onChange={e => {
                                        const code = e.target.value
                                        setCells(cells =>
                                            cells.map((c, i) => i === idx ? { ...c, code } : c)
                                        )
                                    }}
                                    disabled={isLoading}
                                />
                                <pre className="w-full min-h-8 mt-2 p-2 bg-black text-green-400 rounded font-mono text-sm whitespace-pre-wrap overflow-auto border">
                                    {cell.output}
                                </pre>
                            </div>
                        ))}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>status: {pyodideReady ? "✅ Pyodide Ready" : "⏳ Loading Pyodide..."}</span>
                            <span>by pyodide wasm</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}