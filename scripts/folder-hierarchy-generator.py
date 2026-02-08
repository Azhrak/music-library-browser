import os
import json
import argparse
from pathlib import Path

def get_folder_hierarchy(path, ignore_folders=None):
    """
    Recursively build a folder hierarchy dictionary from the given path.
    
    Args:
        path (str): The path to start building the hierarchy from.
        ignore_folders (list): List of folder names to ignore.
        
    Returns:
        dict: A dictionary representing the folder hierarchy.
    """
    result = {}
    path_obj = Path(path)
    
    if ignore_folders is None:
        ignore_folders = []
    
    # Get all items in the current directory
    try:
        # Skip hidden files/folders (those starting with .) and ignored folders
        items = [item for item in path_obj.iterdir() 
                if not item.name.startswith('.') 
                and item.is_dir()
                and item.name not in ignore_folders]
        
        # Process directories
        for item in items:
            # Recursively get the hierarchy of this subdirectory
            result[item.name] = get_folder_hierarchy(item, ignore_folders)
                
        return result
    except PermissionError:
        return {"error": "Permission denied"}
    except Exception as e:
        return {"error": str(e)}

def main():
    parser = argparse.ArgumentParser(description='Generate a JSON file with folder hierarchy.')
    parser.add_argument('path', help='The path to generate hierarchy from')
    parser.add_argument('-o', '--output', default='folder_hierarchy.json', 
                        help='Output JSON file name (default: folder_hierarchy.json)')
    parser.add_argument('-i', '--ignore', nargs='+', default=[],
                        help='List of folder names to ignore (e.g., -i node_modules .git bin)')
    
    args = parser.parse_args()
    
    start_path = args.path
    output_file = args.output
    ignore_folders = args.ignore
    
    # Check if the path exists
    if not os.path.exists(start_path):
        print(f"Error: Path '{start_path}' does not exist.")
        return
    
    # Check if the path is a directory
    if not os.path.isdir(start_path):
        print(f"Error: Path '{start_path}' is not a directory.")
        return
    
    # Get the folder hierarchy
    print(f"Building folder hierarchy from '{start_path}'...")
    if ignore_folders:
        print(f"Ignoring folders: {', '.join(ignore_folders)}")
    
    folder_hierarchy = {os.path.basename(os.path.abspath(start_path)): 
                        get_folder_hierarchy(start_path, ignore_folders)}
    
    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(folder_hierarchy, f, indent=2, ensure_ascii=False)
    
    print(f"Folder hierarchy saved to '{output_file}'")

if __name__ == "__main__":
    main()
