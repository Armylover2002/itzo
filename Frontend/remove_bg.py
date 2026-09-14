import os
from PIL import Image

def remove_white_bg(img_path):
    print(f"Processing {img_path}")
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return
        
    img = Image.open(img_path)
    img = img.convert("RGBA")
    data = img.getdata()

    newData = []
    # Tolerance for almost white pixels
    for item in data:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(img_path, "PNG")
    print(f"Saved {img_path}")

base_path = r"c:\Users\trish\Desktop\Blaze_New\Frontend\public\super-app"
images = ["food.png", "grocery.png", "taxi.png"]

for img in images:
    remove_white_bg(os.path.join(base_path, img))
