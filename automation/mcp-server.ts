// MCP 服务器：把"自动录入"暴露成一个 AI 可调用工具。
// 这样任何兼容 MCP 的 AI 客户端（如 Claude Desktop、Cursor）都能直接说
// "把这条运单录进系统"，由本服务器经 CDP 真正执行。
//
// 运行：npm run mcp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fillWebSystem } from "./fill-web.js";

const server = new McpServer({
  name: "fde-automation",
  version: "0.1.0",
});

server.tool(
  "automate_data_entry",
  {
    fields: z
      .record(z.string())
      .describe("要录入目标系统的字段，如 { tracking_no, receiver, address, phone }"),
  },
  async ({ fields }) => {
    await fillWebSystem(fields);
    return {
      content: [{ type: "text", text: "已触发网页系统自动录入" }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP 服务器(fde-automation)已启动，等待 AI 客户端连接...");
