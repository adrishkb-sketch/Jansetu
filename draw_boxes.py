import sys
import json
from PIL import Image, ImageDraw

def draw_boxes(img_path, output_path, boxes_json):
    try:
        im = Image.open(img_path)
        draw = ImageDraw.Draw(im)
        width, height = im.size
        
        # Parse JSON
        boxes = json.loads(boxes_json)
        
        for box in boxes:
            x = box.get('x', 0)
            y = box.get('y', 0)
            w = box.get('width', 0)
            h = box.get('height', 0)
            label = box.get('label', 'Issue')
            severity = box.get('severity', '')
            
            # Convert percentage dimensions to actual pixel dimensions
            px_x1 = max(0, min(width - 1, int(x * width / 100)))
            px_y1 = max(0, min(height - 1, int(y * height / 100)))
            px_x2 = max(0, min(width - 1, int((x + w) * width / 100)))
            px_y2 = max(0, min(height - 1, int((y + h) * height / 100)))
            
            # Draw thick red boundary box
            draw.rectangle([px_x1, px_y1, px_x2, px_y2], outline="red", width=4)
            
            # Text label formatting
            text_str = f"{label} ({severity})" if severity else label
            
            # Simple text bounding box background
            text_w = len(text_str) * 8 + 10
            text_h = 16
            
            # Draw text label background
            draw.rectangle([px_x1, max(0, px_y1 - text_h), px_x1 + text_w, px_y1], fill="red")
            # Draw white text
            draw.text((px_x1 + 6, max(0, px_y1 - text_h + 2)), text_str, fill="white")
            
        im.save(output_path)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python3 draw_boxes.py <input_img> <output_img> <boxes_json>")
        sys.exit(1)
    draw_boxes(sys.argv[1], sys.argv[2], sys.argv[3])
