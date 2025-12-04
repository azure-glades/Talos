# Skill description
#--------IMPORTS-------------#
import keyboard
#----------------------------

from skill_io import *

# def checkPress(key_list):
#     res = [keyboard.is_pressed(key) for key in key_list]
#     return res

def userMain(keyboard_input_IP_obj) -> keyboard_input_OP:
    #----------- Input unwrapping -----------#
    key_list = keyboard_input_IP_obj.keys
    #----------------------------------------
    OP_obj = keyboard_input_OP()
    #----------- User-Driver Code -----------#
    res =  [keyboard.is_pressed(key) for key in key_list]
    #----------------------------------------

    #-------- Output->Object wrapping -------#
    OP_obj.pressed = res
    #----------------------------------------
    
    return OP_obj


# # Example usage:
# if __name__ == "__main__":
#     keys = ["a", "b", "space", "ctrl", "shift"]
#     print("Press some keys...")

#     try:
#         while True:
#             states = checkPress(keys)
#             print(dict(zip(keys, states)))
#     except KeyboardInterrupt:
#         print("\nStopped.")
