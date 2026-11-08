// Local-only SMTP sink for automated tests. It never forwards mail to the internet.
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
const messages = [];
const smtp = net.createServer(socket => {
  socket.setEncoding('utf8'); socket.write('220 localhost SVIET test SMTP\r\n');
  let buffer = '', data = false, lines = [], recipients = [];
  socket.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
      if (data) {
        if (line === '.') { messages.push({ to: recipients, raw: lines.join('\r\n') }); data = false; lines = []; recipients = []; socket.write('250 accepted by local test sink\r\n'); }
        else lines.push(line.startsWith('..') ? line.slice(1) : line);
      } else if (/^EHLO|^HELO/i.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n');
      else if (/^RCPT TO:/i.test(line)) { const to = /<([^>]+)>/.exec(line)?.[1] ?? ''; if(to.endsWith('@rejected.invalid')) socket.write('550 Recipient rejected for testing\r\n'); else { recipients.push(to); socket.write('250 OK\r\n'); } }
      else if (/^DATA/i.test(line)) { data = true; socket.write('354 End with dot\r\n'); }
      else if (/^QUIT/i.test(line)) { socket.end('221 Bye\r\n'); }
      else { if (/^RSET/i.test(line)) { data = false; lines = []; recipients = []; } socket.write('250 OK\r\n'); }
    }
  });
  socket.on('error', () => {});
});
const api = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); if(req.method === 'DELETE') { messages.length = 0; res.end('{}'); } else res.end(JSON.stringify(messages)); });
await Promise.all([new Promise(r => smtp.listen(2525, '127.0.0.1', r)), new Promise(r => api.listen(2526, '127.0.0.1', r))]);
const args = process.argv.slice(2);
if (!args.length) throw Error('Expected a child command.');
const child = spawn(args[0], args.slice(1), { stdio: 'inherit', env: { ...process.env, SMTP_HOST: '127.0.0.1', SMTP_PORT: '2525', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: 'SVIET Test <sender@example.invalid>' } });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { child.kill(sig); smtp.close(); api.close(); });
child.on('exit', code => { smtp.close(); api.close(); process.exit(code ?? 0); });
