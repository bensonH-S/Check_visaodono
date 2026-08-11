// MeridianBkSync — launcher oculto (sem expor .env).
// Compilado no build do kit com csc.exe.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

internal static class Program
{
    private static int Main()
    {
        try
        {
            var root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (string.IsNullOrEmpty(root)) root = Environment.CurrentDirectory;

            var node = Path.Combine(root, "runtime", "node", "node.exe");
            var script = Path.Combine(root, "worker.mjs");
            if (!File.Exists(node))
            {
                ErrorLog(root, "node.exe ausente em runtime\\node");
                return 2;
            }
            if (!File.Exists(script))
            {
                ErrorLog(root, "worker.mjs ausente");
                return 3;
            }
            if (!File.Exists(Path.Combine(root, "data", "vault.dat")))
            {
                ErrorLog(root, "cofre data\\vault.dat ausente");
                return 4;
            }

            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + script + "\"",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            // Garante PATH do node do kit
            var nodeDir = Path.Combine(root, "runtime", "node");
            var path = Environment.GetEnvironmentVariable("PATH") ?? "";
            psi.Environment["PATH"] = nodeDir + Path.PathSeparator + path;
            psi.Environment["PLAYWRIGHT_BROWSERS_PATH"] = Path.Combine(root, "runtime", "ms-playwright");

            using (var p = Process.Start(psi))
            {
                if (p == null) return 5;
                p.WaitForExit();
                return p.ExitCode;
            }
        }
        catch (Exception ex)
        {
            try { ErrorLog(Environment.CurrentDirectory, ex.ToString()); } catch { }
            return 1;
        }
    }

    private static void ErrorLog(string root, string msg)
    {
        var dir = Path.Combine(root, "Logs");
        Directory.CreateDirectory(dir);
        File.AppendAllText(
            Path.Combine(dir, "bkoffice-python-service.log"),
            "[bk-kit] " + DateTime.Now.ToString("o") + " LAUNCHER " + msg + Environment.NewLine
        );
    }
}
