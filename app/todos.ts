// Todos:
// - add support for jupyterwidgets, so that we can use ipywidgets in the notebook
// also maybe add support for more advanced libraries, like pytorch, tensorflow, which require cloud computing instead of a pyodide instance

// also add a way to cache the notebook in local storage, so that it can be reloaded later
// also use the already existing binaries in /public/pyodide to speed up loading, as pyodide is quite slow to load
// also add a way to import an ipynb file, and convert it to this format, and vice versa