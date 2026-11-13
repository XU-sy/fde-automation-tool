/** @type {import('next').NextConfig} */
const nextConfig = {
  // 为什么加这一行？
  //   playwright 是 Node 原生能力库（内部有动态 require、要按平台找浏览器二进制路径），
  //   Next 的打包器（webpack/turbopack）硬去 bundle 它容易在构建期报错。
  //   serverExternalPackages 的意思是"这个包不要打包，运行时直接从 node_modules 加载"。
  //   副作用：云端构建产物更小、构建更快。
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
