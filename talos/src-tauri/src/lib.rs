// src-tauri/src/lib.rs
mod skills;

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BotEntry {
    name: String,
    description: String,
    path: String,
}

fn base_projects_path() -> PathBuf {
    PathBuf::from(format!("./projects"))
}

fn bots_dir() -> PathBuf {
    base_projects_path().join("bots")
}

fn bots_list_path() -> PathBuf {
    bots_dir().join("bots_list.yaml")
}

#[tauri::command]
fn create_bot(bot_name: String, bot_description: String, custom_path: Option<String>) -> Result<String, String> {
    // Ensure base folders exist
    let base = base_projects_path();
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    }

    let bots_folder = bots_dir();
    if !bots_folder.exists() {
        fs::create_dir_all(&bots_folder).map_err(|e| e.to_string())?;
    }

    // Determine bot folder
    let bot_folder = if let Some(ref path) = custom_path {
        if !path.trim().is_empty() {
            let custom_dir = PathBuf::from(path);
            if !custom_dir.exists() {
                fs::create_dir_all(&custom_dir).map_err(|e| e.to_string())?;
            }
            custom_dir.join(&bot_name)
        } else {
            bots_folder.join(&bot_name)
        }
    } else {
        bots_folder.join(&bot_name)
    };

    if bot_folder.exists() {
        return Err(format!("Bot '{}' already exists", bot_name));
    }

    // Create folders
    fs::create_dir_all(&bot_folder).map_err(|e| e.to_string())?;
    fs::create_dir_all(bot_folder.join("src")).map_err(|e| e.to_string())?;
    fs::create_dir_all(bot_folder.join("skills")).map_err(|e| e.to_string())?;

    // Default files
    fs::write(
        bot_folder.join("config.yaml"),
        format!("name: {}\ndescription: {}\n", bot_name, bot_description),
    )
    .map_err(|e| e.to_string())?;

    fs::write(bot_folder.join("src/main.py"), "# main bot logic goes here\n")
        .map_err(|e| e.to_string())?;

    // Update global bots list
    let list_path = bots_list_path();

    let mut bots: Vec<BotEntry> = if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    bots.push(BotEntry {
        name: bot_name.clone(),
        description: bot_description.clone(),
        path: bot_folder.to_string_lossy().to_string(),
    });

    let yaml_data = serde_yaml::to_string(&bots).map_err(|e| e.to_string())?;
    fs::write(&list_path, yaml_data).map_err(|e| e.to_string())?;

    Ok(format!(
        "Created bot '{}' at '{}'",
        bot_name,
        bot_folder.display()
    ))
}

#[tauri::command]
fn get_bots_list() -> Result<Vec<BotEntry>, String> {
    let list_path = bots_list_path();

    if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        let bots: Vec<BotEntry> = serde_yaml::from_str(&content).unwrap_or_default();
        Ok(bots)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn load_skill_graph(bot_path: String) -> Result<String, String> {
    use std::{fs, path::PathBuf};

    let bot_dir = PathBuf::from(&bot_path);
    let file_path = bot_dir.join("skillgraph.json");

    // If file doesn't exist, create a default graph
    if !file_path.exists() {
        let default_graph = r#"{
            "nodes": [
                {
                    "id": "start",
                    "x": 200,
                    "y": 300,
                    "label": "Start",
                    "skillType": "start",
                    "inputs": [],
                    "outputs": [
                        {
                            "id": "exec_out",
                            "label": "Exec",
                            "type": "EXEC",
                            "io": "output"
                        }
                    ]
                },
                {
                    "id": "end",
                    "x": 1000,
                    "y": 300,
                    "label": "End",
                    "skillType": "end",
                    "inputs": [
                        {
                            "id": "exec_in",
                            "label": "Exec",
                            "type": "EXEC",
                            "io": "input"
                        }
                    ],
                    "outputs": []
                }
            ],
            "edges": [
                {
                    "fromSkillId": "start",
                    "fromPortId": "exec_out",
                    "toSkillId": "end",
                    "toPortId": "exec_in",
                    "type": "execution"
                }
            ]
        }"#;

        fs::write(&file_path, default_graph).map_err(|e| e.to_string())?;
        return Ok(default_graph.to_string());
    }

    // Otherwise, read and return the existing file
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(content)
}


#[tauri::command]
fn save_skill_graph(bot_path: String, graph_json: String) -> Result<(), String> {
    //TODO: do checks before saving. (loops, improper connections etc)
    let base = PathBuf::from(bot_path);
    let file_path = base.join("skillgraph.json");

    fs::write(&file_path, graph_json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_bot,
            get_bots_list,
            load_skill_graph,
            save_skill_graph,
            skills::get_skills_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
