import { spawn } from "node:child_process";
import path from "node:path";
import type { PythonWorkerResult, StoredDocumentJob } from "@/lib/types";

const WORKER_PATH = path.join("workers", "python", "worker.py");

export class PythonWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonWorkerError";
  }
}

export async function runPythonWorker(
  job: StoredDocumentJob,
): Promise<PythonWorkerResult> {
  const pythonBin = process.env.DOCUTOR_PYTHON_BIN ?? "python3";
  const outputDir = path.join(path.dirname(job.originalPath), "normalized");

  const args = [
    WORKER_PATH,
    "--input",
    job.originalPath,
    "--output-dir",
    outputDir,
    "--document-id",
    job.id,
    "--source-file-name",
    job.sourceFileName,
    "--file-type",
    job.sourceFileType,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(new PythonWorkerError(error.message));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new PythonWorkerError(
            stderr.trim() || `Python Worker exited with code ${code}.`,
          ),
        );
        return;
      }

      try {
        resolve({
          document: JSON.parse(stdout) as PythonWorkerResult["document"],
          stderr: stderr.trim() || undefined,
        });
      } catch (error) {
        reject(
          new PythonWorkerError(
            `Python Worker returned invalid JSON: ${(error as Error).message}`,
          ),
        );
      }
    });
  });
}
