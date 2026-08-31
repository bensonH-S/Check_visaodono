// MeridianBkSync — launcher SEM janela preta (/target:winexe).
// Compilado no build do kit com csc.exe.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        var root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        if (string.IsNullOrEmpty(root)) root = Environment.CurrentDirectory;

        var debug = Array.Exists(args, a => a == "--debug" || a == "/debug");
        try
        {
            Log(root, "launcher start root=" + root);

            var node = Path.Combine(root, "runtime", "node", "node.exe");
            var script = Path.Combine(root, "worker.mjs");
            var vault = Path.Combine(root, "data", "vault.dat");

            if (!File.Exists(node))
            {
                Fail(root, "node.exe ausente em runtime\\node");
                return 2;
            }
            if (!File.Exists(script))
            {
                Fail(root, "worker.mjs ausente");
                return 3;
            }
            if (!File.Exists(vault))
            {
                Fail(root, "cofre data\\vault.dat ausente — regenere o kit");
                return 4;
            }

            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + script + "\"" + (debug ? " --once" : ""),
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = !debug,
                WindowStyle = debug ? ProcessWindowStyle.Normal : ProcessWindowStyle.Hidden,
                RedirectStandardOutput = debug,
                RedirectStandardError = debug,
            };
            var nodeDir = Path.Combine(root, "runtime", "node");
            var path = Environment.GetEnvironmentVariable("PATH") ?? "";
            psi.Environment["PATH"] = nodeDir + Path.PathSeparator + path;
            psi.Environment["PLAYWRIGHT_BROWSERS_PATH"] = Path.Combine(root, "runtime", "ms-playwright");

            Log(root, "starting node worker" + (debug ? " (--once)" : " (loop oculto)"));
            using (var p = Process.Start(psi))
            {
                if (p == null)
                {
                    Fail(root, "nao foi possivel iniciar node");
                    return 5;
                }
                if (debug)
                {
                    p.OutputDataReceived += (_, e) => { if (e.Data != null) Log(root, "out " + e.Data); };
                    p.ErrorDataReceived += (_, e) => { if (e.Data != null) Log(root, "err " + e.Data); };
                    p.BeginOutputReadLine();
                    p.BeginErrorReadLine();
                }
                p.WaitForExit();
                Log(root, "node exit=" + p.ExitCode);
                return p.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Fail(root, ex.ToString());
            return 1;
        }
    }

    private static void Fail(string root, string msg)
    {
        Log(root, "ERRO " + msg);
        // Sem MessageBox: tarefa agendada fica presa num OK que ninguem clica.
    }

    private static void Log(string root, string msg)
    {
        try
        {
            var dir = Path.Combine(root, "Logs");
            Directory.CreateDirectory(dir);
            File.AppendAllText(
                Path.Combine(dir, "bkoffice-python-service.log"),
                "[bk-kit] " + DateTime.Now.ToString("o") + " " + msg + Environment.NewLine
            );
        }
        catch { }
    }
}
