// Offline demo proof: the server process behaves as if the venue Wi-Fi were down. Every hostname that is not loopback
// fails to resolve (ENOTFOUND, as with no network) and every raw non-loopback IP is unreachable.
// Load with NODE_OPTIONS="--require ./e2e/offline-net.cjs"; refused hosts are appended to logs/offline-blocked.log.
const dns = require("node:dns");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const LOG = path.join(process.cwd(), "logs", "offline-blocked.log");
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0|::ffff:127\.0\.0\.1|::)$/i;

function refuse(host) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${host}\n`);
  } catch {}
}
const notFound = (host) =>
  Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), {
    code: "ENOTFOUND",
    syscall: "getaddrinfo",
    hostname: host,
  });

const lookup = dns.lookup;
dns.lookup = function (host, opts, cb) {
  const done = typeof opts === "function" ? opts : cb;
  if (LOCAL.test(String(host))) return lookup.call(this, host, opts, cb);
  refuse(host);
  process.nextTick(() => done(notFound(host)));
  return {};
};
const lookupP = dns.promises.lookup;
dns.promises.lookup = async (host, opts) => {
  if (LOCAL.test(String(host))) return lookupP(host, opts);
  refuse(host);
  throw notFound(host);
};

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0]; // node passes normalized [options, cb] internally
  const host = first && typeof first === "object" ? first.host : undefined;
  if (!host || !net.isIP(host) || LOCAL.test(host)) return connect.apply(this, args); // hostnames go through dns.lookup
  refuse(host);
  const err = Object.assign(new Error(`connect ENETUNREACH ${host}`), { code: "ENETUNREACH" });
  process.nextTick(() => this.destroy(err));
  return this;
};
