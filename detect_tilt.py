import cv2
import numpy as np
import sys

def detect_tilt(image_path):
    image = cv2.imread(image_path, 0)
    edges = cv2.Canny(image, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, 200)

    if lines is not None:
        angles = []
        for rho, theta in lines[:, 0]:
            angle = np.degrees(theta)
            if angle > 180:
                angle -= 180
            angles.append(angle)
        median_angle = np.median(angles)
        tilt_angle = median_angle - 84.7
    else:
        tilt_angle = 0

    return tilt_angle

if __name__ == "__main__":
    image_path = sys.argv[1]
    tilt_angle = detect_tilt(image_path)
    print(tilt_angle)
