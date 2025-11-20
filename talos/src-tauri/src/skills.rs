use crate::{BotEntry, base_projects_path, bots_dir, bots_list_path};
use std::fs;
use std::process::Command;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkillEntry {
    name: String,
    path: String,
}

fn skills_dir() -> PathBuf {
    PathBuf::from(format!("./skills"))
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


#[tauri::command]
pub fn get_skills_list() -> Result<Vec<SkillEntry>, String> {
    let list_path = skills_dir().join("skills_list.yaml");

    if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        let bots: Vec<SkillEntry> = serde_yaml::from_str(&content).unwrap_or_default();
        Ok(bots)
    } else {
        Ok(Vec::new())
    }
}