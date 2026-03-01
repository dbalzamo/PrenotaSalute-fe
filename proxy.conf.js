const PROXY_CONFIG = [
  {
    context: ["/prenotazione-medica"],
    target: "http://localhost:8080",
    secure: false,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq, req) => {
        if (req.headers?.authorization) {
          proxyReq.setHeader("Authorization", req.headers.authorization);
        }
      });
    }
  }
];

module.exports = PROXY_CONFIG;
