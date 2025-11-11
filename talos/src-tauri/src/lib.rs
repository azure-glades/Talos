// src-tauri/src/lib.rs
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use whoami;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BotEntry {
    name: String,
    description: String,
    path: String,
}

#[tauri::command]
fn create_bot(bot_name: String, bot_description: String, custom_path: Option<String>) -> Result<String, String> {
    // Base Talos path in Documents
    let username = whoami::username();
    let base_path = PathBuf::from(format!("C:/Users/{}/Documents/talos", username));
    if !base_path.exists() {
        fs::create_dir_all(&base_path).map_err(|e| e.to_string())?;
    }

    // Determine bot folder path
    let bot_folder = if let Some(ref path) = custom_path {
        if !path.trim().is_empty() {
            let custom_dir = PathBuf::from(path);
            if !custom_dir.exists() {
                fs::create_dir_all(&custom_dir).map_err(|e| e.to_string())?;
            }
            custom_dir.join(&bot_name)
        } else {
            base_path.join(&bot_name)
        }
    } else {
        base_path.join(&bot_name)
    };
    
    // Prevent overwriting existing bot folder
    if bot_folder.exists() {
        return Err(format!("Bot '{}' already exists", bot_name));
    }

    // Create bot folder structure
    fs::create_dir_all(&bot_folder).map_err(|e| e.to_string())?;
    fs::create_dir_all(bot_folder.join("src")).map_err(|e| e.to_string())?;

    // Write default files
    fs::write(
        bot_folder.join("config.yaml"),
        format!("name: {}\ndescription: {}\n", bot_name, bot_description),
    )
    .map_err(|e| e.to_string())?;
    fs::write(bot_folder.join("main.py"), "# main bot logic goes here\n")
        .map_err(|e| e.to_string())?;

    // Update global bots list in Documents/talos/bots_list.yaml
    let list_path = base_path.join("bots_list.yaml");

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
    let username = whoami::username();
    let list_path = PathBuf::from(format!("C:/Users/{}/Documents/talos/bots_list.yaml", username));

    if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        let bots: Vec<BotEntry> = serde_yaml::from_str(&content).unwrap_or_default();
        Ok(bots)
    } else {
        Ok(Vec::new())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![create_bot, get_bots_list])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
