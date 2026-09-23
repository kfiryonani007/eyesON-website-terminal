#!/usr/bin/env node
/* Produces the two values the admin panel needs:
 *
 *   node scripts/hash-password.js
 *
 * The password is typed in hidden. It is never echoed, never written to a
 * file, and never accepted as a command-line argument — arguments end up in
 * your shell history and in the process list.
 *
 * What it prints is a scrypt hash plus a random session secret. Neither can
 * be turned back into the password, so both are safe to paste into Vercel.
 */
"use strict";

const crypto = require("crypto");
const readline = require("readline");
const fs = require("fs");

const MIN_LENGTH = 12;

/* Piped input (tests, CI) has no TTY to hide. Read the whole stream once and
   hand out lines — opening a readline per question lets the first one swallow
   everything that follows. */
let pipedLines = null;
function nextPipedLine() {
  if (pipedLines === null) {
    let raw = "";
    try {
      raw = fs.readFileSync(0, "utf8");
    } catch (e) {
      raw = "";
    }
    pipedLines = raw.split("\n");
  }
  return (pipedLines.shift() || "").replace("\r", "").trim();
}

/* Hidden input by overriding readline's own echo. Attaching a raw "data"
   listener instead (the other common trick) steals the keystrokes from
   readline on Windows, so the answer comes back empty. */
function askHidden(question) {
  if (!process.stdin.isTTY) return Promise.resolve(nextPipedLine());

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let echoing = false;
    rl._writeToOutput = function (chunk) {
      if (!echoing) {
        // print the prompt once, then swallow every echoed character
        if (chunk.indexOf(question) !== -1) {
          rl.output.write(question);
          echoing = true;
        }
        return;
      }
      if (chunk === "\r\n" || chunk === "\n") rl.output.write(chunk);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function strengthProblem(pw) {
  if (pw.length === 0) {
    return "לא נקלטה שום הקלדה. אם זה חוזר, הריצו:  node scripts/hash-password.js --show";
  }
  if (pw.length < MIN_LENGTH) {
    return "קצרה מדי — לפחות " + MIN_LENGTH + " תווים (הוקלדו " + pw.length + ").";
  }
  if (/^[0-9]+$/.test(pw)) return "ספרות בלבד. הוסיפו אותיות.";
  if (/^[a-zA-Z]+$/.test(pw) && pw.length < 16) return "אותיות בלבד וקצרה. הוסיפו ספרה או סימן.";
  if (/[֐-׿]/.test(pw)) {
    return "יש כאן אותיות בעברית. זה עלול לא לעבוד בכל מקלדת — השתמשו באנגלית.";
  }
  return null;
}

/* Visible fallback for terminals where hiding misbehaves. Still never touches
   the shell history, because it is typed at a prompt and not as an argument. */
function askVisible(question) {
  if (!process.stdin.isTTY) return Promise.resolve(nextPipedLine());
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const LINE = "=".repeat(64);

(async () => {
  const args = process.argv.slice(2);
  const show = args.indexOf("--show") !== -1;
  const stray = args.filter((a) => a !== "--show");

  if (stray.length) {
    console.error("\nאל תעבירו את הסיסמה כארגומנט — היא נשמרת בהיסטוריית הטרמינל.");
    console.error("הריצו בלי שום דבר אחרי שם הקובץ:\n");
    console.error("   node scripts/hash-password.js\n");
    process.exit(1);
  }

  const ask = show ? askVisible : askHidden;
  if (show) {
    console.log("\n⚠  מצב גלוי: הסיסמה תופיע על המסך. סגרו את החלון כשתסיימו.\n");
  }

  const pw = await ask(show ? "סיסמת המנהל: " : "סיסמת המנהל (ההקלדה מוסתרת): ");
  const problem = strengthProblem(pw);
  if (problem) {
    console.error("\n" + problem + "\nלא נוצר כלום. נסו שוב.\n");
    process.exit(1);
  }

  const again = await ask(show ? "שוב, לאימות: " : "שוב, לאימות (מוסתר): ");
  if (again !== pw) {
    console.error("\nשתי ההקלדות לא זהות. לא נוצר כלום.\n");
    process.exit(1);
  }

  const N = 16384;
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32, { N, r: 8, p: 1 });

  console.log("\n" + LINE);
  console.log("שני הערכים הבאים בטוחים להעתקה. אי אפשר לשחזר מהם את הסיסמה.");
  console.log(LINE + "\n");
  console.log("ADMIN_PASSWORD_HASH");
  console.log("scrypt$" + N + "$" + salt.toString("hex") + "$" + key.toString("hex") + "\n");
  console.log("SESSION_SECRET");
  console.log(crypto.randomBytes(48).toString("base64url") + "\n");
  console.log(LINE);
  console.log("הסיסמה עצמה לא נשמרה בשום מקום. אם תשכחו אותה, מייצרים חדשה.");
  console.log(LINE + "\n");
})();
