use std::io::{self, Read};

fn main() -> io::Result<()> {
    println!("Type characters (press 'q' to quit):");
    
    loop {
        let mut buffer = [0; 1]; // Buffer for one character
        
        match io::stdin().read(&mut buffer) {
            Ok(0) => break, // EOF
            Ok(_) => {
                let ch = buffer[0] as char;
                println!("You pressed: {}", ch);
                
                if ch == 'q' {
                    println!("Goodbye!");
                    break;
                }
            }
            Err(error) => {
                eprintln!("Error: {}", error);
                break;
            }
        }
    }
    
    Ok(())
}