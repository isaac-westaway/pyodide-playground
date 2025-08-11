export const pythonUtilityFunctions = () => `
import sys, io, traceback, base64
import json
from contextlib import redirect_stdout, redirect_stderr
from io import BytesIO

exec_globals = __notebook_globals__

def _format_last_expression(obj):
    try:
        if 'matplotlib.figure.Figure' in str(type(obj)):
            buf = BytesIO()
            obj.savefig(buf, format='png')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            return f"<img src='data:image/png;base64,{img_base64}'>"
        if 'pandas.core.frame.DataFrame' in str(type(obj)):
            return f"<div class='dataframe'>{obj.to_html()}</div>"
    except Exception as e:
        return str(obj) + f"\\n[formatting error: {e}]"
    return str(obj)

def _check_for_matplotlib_figures():
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            fig = plt.gcf()
            buf = BytesIO()
            fig.savefig(buf, format='png')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            plt.close('all')  # Close to prevent accumulation
            return f"<img src='data:image/png;base64,{img_base64}'>"
    except ImportError:
        pass
    return None

def _handle_magic_line(magic_line):
    magic_line = magic_line.strip()
    if magic_line == '%matplotlib inline':
        import matplotlib
        matplotlib.use('Agg')
        return {'matplotlib_used': True}
    return {}

def _preprocess_code(raw_code):
    lines = raw_code.strip().split('\\n')
    matplotlib_used = False
    matplotlib_imported = False
    processed_lines = []

    for line in lines:
        if line.strip().startswith('%'):
            magic_result = _handle_magic_line(line)
            if magic_result.get('matplotlib_used'):
                matplotlib_used = True
        else:
            if 'import matplotlib' in line or 'from matplotlib' in line or 'plt.' in line:
                matplotlib_imported = True
            processed_lines.append(line)

    # If matplotlib detected but no magic, auto-enable backend
    if matplotlib_imported and not matplotlib_used:
        matplotlib_used = True
        # We prepend the backend setup line to processed_lines
        processed_lines.insert(0, 'import matplotlib; matplotlib.use("Agg")')

    return '\\n'.join(processed_lines), matplotlib_used

def _is_simple_expression(lines):
    indentation_starters = ['def ', 'class ', 'if ', 'for ', 'while ', 'with ', 'try:', 'else:', 'elif ']
    has_block = any(
        any(line.strip().startswith(starter) for starter in indentation_starters) and line.strip().endswith(':')
        for line in lines
    )
    if has_block or not lines:
        return False
    last_line = lines[-1].strip()
    return not any(last_line.startswith(starter) for starter in indentation_starters)
`;

export const pythonExecutionWrapper = (code: string) => `
import json
_stdout = io.StringIO()
_stderr = io.StringIO()
text_output = ""
html_output = None

try:
    code_body, matplotlib_used = _preprocess_code(${JSON.stringify(code)})
    _code_lines = code_body.split('\\n')
    last_expr = None

    with redirect_stdout(_stdout), redirect_stderr(_stderr):
        if _is_simple_expression(_code_lines):
            exec_code = '\\n'.join(_code_lines[:-1])
            last_line = _code_lines[-1].strip()

            if exec_code:
                exec(exec_code, exec_globals)
            try:
                last_expr = eval(last_line, exec_globals)
            except SyntaxError:
                exec(code_body, exec_globals)
        else:
            exec(code_body, exec_globals)

        if matplotlib_used:
            html_output = _check_for_matplotlib_figures()

    stdout_val = _stdout.getvalue()
    stderr_val = _stderr.getvalue()
    text_output = stdout_val + (stderr_val if stderr_val else "")

    if last_expr is not None and html_output is None:
        formatted_expr = _format_last_expression(last_expr)
        if formatted_expr.startswith('<'):
            html_output = formatted_expr
        else:
            text_output = (text_output + "\\n" if text_output else "") + formatted_expr

except Exception:
    traceback.print_exc(file=_stderr)
    text_output = _stdout.getvalue() + "\\n" + _stderr.getvalue()

json.dumps({
    "text": text_output.strip(),
    "html": html_output or ""
})
`;

export const captureCode = (code: string) => `
${pythonUtilityFunctions()}
${pythonExecutionWrapper(code)}
`;
