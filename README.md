# jev-mcp

A stdio MCP server that exposes TypeSafe Jev as the `jev_ask` tool.

## Install

```sh
git clone https://github.com/kevinqpeng/jev-mcp.git
npm install --global ./jev-mcp
```

Set `TYPESAFE_API_KEY` in the MCP client's server environment. `JEV_MODEL` is optional and defaults to `jev-latest`.

Configure the client to run `jev-mcp` over stdio. The tool accepts a `state` and a map of typed `questions` (`choice`, `score`, or `noul`).
