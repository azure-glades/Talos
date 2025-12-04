use crate::{bots_dir};
use std::fs;
use std::process::Command;
use std::path::PathBuf;
use serde_json;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkillEntry {
    name: String,
    path: String
}

#[derive(Deserialize)]
struct GraphJson {
    nodes: Vec<Node>,
    edges: Vec<Edge>,
}

#[derive(Deserialize)]
struct Node {
    id: String,
    skillType: String,
}

#[derive(Deserialize)]
struct Edge {
    fromSkillId: String,
    toSkillId:   String,
    edgeType: String
}

fn skills_dir() -> PathBuf { // hardcoded to Prar bot
    bots_dir().join("Prar/skills")
}

pub fn compile_skills() -> Result<(), Box<dyn std::error::Error>> {
    let skills_path = skills_dir();
    let output_dir = PathBuf::from("./skills/bin");

    if !skills_path.exists() {
        fs::create_dir_all(&skills_path).map_err(|e| e.to_string())?;
    }
    if !output_dir.exists() {
        fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    }

    let entries = fs::read_dir(&skills_path)?;

    for entry in entries {
        let entry = entry?;
        let file_path = entry.path();

        if file_path.is_dir() {
            continue;
        }

        // Only compile Rust files
        if file_path.extension().map_or(false, |ext| ext == "rs") {
            if let Some(file_name) = file_path.file_stem().and_then(|s| s.to_str()) {
                println!("Compiling: {}", file_name);
                
                let output_path = output_dir.join(file_name);
                Command::new("rustc")
                    .arg(&file_path)
                    .arg("-o")
                    .arg(&output_path) 
                    .output()?;
            }
        }
    }

    Ok(())
}

// stupid fucking tauri swallows stdout
fn debug_log(msg: &str) {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("bot_debug.log")
        .unwrap();

    writeln!(f, "{msg}").unwrap();
}

#[tauri::command]
pub fn load_skills() -> Result<Vec<String>, String> {
    let skill_graph_path = bots_dir().join("Prar").join("skillgraph.json");
    debug_log(&format!("Resolved skill_graph_path = {}",skill_graph_path.display()));

    let tmp   = fs::read_to_string(skill_graph_path).map_err(|e| e.to_string())?;
    let g: GraphJson = serde_json::from_str(&tmp).map_err(|e| e.to_string())?;

    // read skill-graph - make a vector of the skills to be executed linearly
    let mut current = g.nodes.iter()
                   .find(|n| n.skillType == "start")
                   .ok_or("no start node")?
                   .id
                   .clone();
    let mut order   = Vec::new();

    let exec_edges: Vec<_> = g.edges.iter()
                        .filter(|e| e.edgeType == "execution")
                        .collect();

    // walk exactly as before, but on this filtered list
    while let Some(edge) = exec_edges.iter().find(|e| e.fromSkillId == current) {
        if edge.toSkillId == "end" { break; }
        order.push(edge.toSkillId.clone());
        current = edge.toSkillId.clone();
    }

    Ok(order)
}

#[tauri::command]
pub fn launch_bot() -> Result<String, String> {

    debug_log("launch_bot called");
    let skills = load_skills()?;
    debug_log("skills loaded");

    // assuming skills to be plain old binary executables
    for skill_id in skills {
        let mut bin_path = skills_dir().join("target").join(&skill_id);
        debug_log(&format!("Path: {}", bin_path.display()));

        let status = Command::new("x-terminal-emulator")
            .arg("-e")
            .arg(&bin_path)
            .status()
            .map_err(|e| format!("failed to start {}: {}", skill_id, e))?;

        if !status.success() {
            return Err(format!("skill {} exited with {:?}", skill_id, status.code()));
        }
    }

    Ok("all skills completed".into())
}