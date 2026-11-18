import { tsImport } from 'tsx/esm/api';
const { runWorker } = await tsImport('./worker-task.ts', import.meta.url);
await runWorker();
