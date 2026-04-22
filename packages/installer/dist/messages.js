import chalk from "chalk";
export function info(msg) {
    process.stdout.write(`${chalk.cyan("[atw]")} ${msg}\n`);
}
export function success(msg) {
    process.stdout.write(`${chalk.green("[atw]")} ${msg}\n`);
}
export function warn(msg) {
    process.stderr.write(`${chalk.yellow("[atw]")} ${msg}\n`);
}
export function error(msg) {
    process.stderr.write(`${chalk.red("[atw]")} ${msg}\n`);
}
export function step(label, detail) {
    const dim = chalk.gray("›");
    const line = detail ? `${chalk.bold(label)} ${chalk.gray(detail)}` : chalk.bold(label);
    process.stdout.write(`  ${dim} ${line}\n`);
}
export function nextCommand(command) {
    return `\n${chalk.green("✓")} ${chalk.bold("Scaffold complete.")}\n\n  Next: run ${chalk.cyan(command)} inside Claude Code.\n`;
}
export function conflictList(paths) {
    const header = chalk.red("Refusing to overwrite existing files. Use --force to replace (Builder edits to .atw/config/ and .atw/artifacts/ are preserved).");
    const listed = paths.map((p) => `  - ${p}`).join("\n");
    return `${header}\n${listed}\n`;
}
//# sourceMappingURL=messages.js.map