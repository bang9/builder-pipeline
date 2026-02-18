const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

export function info(msg: string): void {
  console.log(`${CYAN}i${RESET} ${msg}`);
}

export function success(msg: string): void {
  console.log(`${GREEN}\u2713${RESET} ${msg}`);
}

export function error(msg: string): void {
  console.error(`${RED}\u2717${RESET} ${msg}`);
}

export function dim(msg: string): string {
  return `${DIM}${msg}${RESET}`;
}

const SPINNER_FRAMES = ['\u280b', '\u2819', '\u2838', '\u2830', '\u2826', '\u280e'];

export function spinner(msg: string): { stop: (finalMsg?: string) => void } {
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r${CYAN}${SPINNER_FRAMES[i % SPINNER_FRAMES.length]}${RESET} ${msg}`);
    i++;
  }, 80);

  return {
    stop(finalMsg?: string) {
      clearInterval(id);
      process.stderr.write('\r\x1b[K'); // clear line
      if (finalMsg) success(finalMsg);
    },
  };
}
