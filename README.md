# Talos



## Development
`npm run tauri dev` runs in dev mode

/projects/bots has all bots
/skills has skills written in rust that are compiled to /skills/bin

skills are visible in projects

to implement:
1. skills are present as modules that can be added to bots. when added, binaries should be copied to /projects/bots/<botname>/skills/
2. orchestrating skills -> take skillgraph.json as input to decide the order of orchestration
3. add a way to see skills in frontend