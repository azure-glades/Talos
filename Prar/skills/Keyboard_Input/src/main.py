# Auto generated code
import os, sys

home = os.path.expanduser("~")  # -> C:/Users/<username>
path = os.path.join(
    home,
    "Documents",
    "talos",
    "assets",
    "lib",
    "std_functs"
)

if path not in sys.path:
    sys.path.append(path)

from read_write_temp import readFromFile, writeToFile


CURRENT = os.path.abspath(os.path.dirname(__file__))
T_O_P = os.path.abspath(os.path.join(CURRENT, "..", "..", "..", "out"))
S_A_P = os.path.abspath(os.path.join(CURRENT, "..", "..", ".."))
os.makedirs(T_O_P, exist_ok=True)
# Define for input files.. might have to read multiple out files based on attributes being connected.
# read from /out if dynamic attribute is being read. If static attribute is used read from bot's config.yaml
CONF_FILE = os.path.join(S_A_P, "config.yaml")
# only 1 output file.
OUTPUT_FILE = os.path.join(T_O_P, "keyboard_input_out.glob")

#--------------------------
from user_main import userMain

from skill_io import *

def main():

    keys = ["w", "a", "s", "d", "space"]
    print("Press some keys...")

    try:
        while True:
            keyboard_input_IP_obj = keyboard_input_IP()
            input_descriptor = [("keys", "v_out", "keys", 1)] #[(fromSkillID, fromAttributeID, toAttributeID, isStatic? 1:0), ...]
            keyboard_input_IP_obj = readFromFile(T_O_P, CONF_FILE, keyboard_input_IP_obj, input_descriptor)
            keyboard_input_OP_obj = userMain(keyboard_input_IP_obj)

            writeToFile(keyboard_input_OP_obj, OUTPUT_FILE, "keyboard_input")

    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()