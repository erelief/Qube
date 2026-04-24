use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
}

pub fn get_image_info(path: String) -> Result<ImageInfo, String> {
    let reader = image::ImageReader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?;
    let (w, h) = reader
        .into_dimensions()
        .map_err(|e| format!("Failed to read dimensions: {}", e))?;
    Ok(ImageInfo {
        width: w,
        height: h,
    })
}

fn mime_from_path(path: &str) -> &'static str {
    match std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    }
}

pub fn read_file_as_data_url(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let mime = mime_from_path(&path);
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

pub fn resize_image(path: String, max_size: u32) -> Result<String, String> {
    let img = image::ImageReader::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let max_dim = img.width().max(img.height());
    if max_dim <= max_size {
        return read_file_as_data_url(path);
    }

    let ratio = max_size as f32 / max_dim as f32;
    let new_w = (img.width() as f32 * ratio) as u32;
    let new_h = (img.height() as f32 * ratio) as u32;
    let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);

    let mut buf = Vec::new();
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let format = match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        _ => image::ImageFormat::Png,
    };
    resized.write_to(&mut std::io::Cursor::new(&mut buf), format)
        .map_err(|e| format!("Failed to encode: {}", e))?;

    let mime = if matches!(ext, "jpg" | "jpeg") { "image/jpeg" } else { "image/png" };
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

mod commands {
    use super::*;

    #[tauri::command]
    pub fn get_image_info(path: String) -> Result<ImageInfo, String> {
        super::get_image_info(path)
    }

    #[tauri::command]
    pub fn read_file_as_data_url(path: String) -> Result<String, String> {
        super::read_file_as_data_url(path)
    }

    #[tauri::command]
    pub fn resize_image(path: String, max_size: u32) -> Result<String, String> {
        super::resize_image(path, max_size)
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_image_info,
            commands::read_file_as_data_url,
            commands::resize_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use image::{ImageFormat, RgbaImage};

    fn create_test_image(path: &str, w: u32, h: u32) {
        let img = RgbaImage::from_pixel(w, h, image::Rgba([255, 0, 0, 255]));
        img.save_with_format(path, ImageFormat::Png).unwrap();
    }

    #[test]
    fn test_get_image_info() {
        let path = std::env::temp_dir().join("test_panorama_info.png");
        create_test_image(path.to_str().unwrap(), 4096, 2048);
        let info = get_image_info(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(info.width, 4096);
        assert_eq!(info.height, 2048);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_file_as_data_url_png() {
        let path = std::env::temp_dir().join("test_panorama_read.png");
        create_test_image(path.to_str().unwrap(), 100, 50);
        let result = read_file_as_data_url(path.to_str().unwrap().to_string()).unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        assert!(result.len() > 100);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_file_as_data_url_jpg() {
        let path = std::env::temp_dir().join("test_panorama_read.jpg");
        let img = image::RgbImage::from_pixel(100, 50, image::Rgb([0, 255, 0]));
        img.save_with_format(&path, ImageFormat::Jpeg).unwrap();
        let result = read_file_as_data_url(path.to_str().unwrap().to_string()).unwrap();
        assert!(result.starts_with("data:image/jpeg;base64,"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_resize_image_no_resize_needed() {
        let path = std::env::temp_dir().join("test_small.png");
        create_test_image(path.to_str().unwrap(), 200, 100);
        let result = resize_image(path.to_str().unwrap().to_string(), 1000).unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_resize_image_downsamples() {
        let path = std::env::temp_dir().join("test_large.png");
        create_test_image(path.to_str().unwrap(), 2000, 1000);
        let result = resize_image(path.to_str().unwrap().to_string(), 500).unwrap();
        // Decode the returned data URL and verify dimensions
        let b64_part = result.split(',').nth(1).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64_part).unwrap();
        let img = image::load_from_memory(&bytes).unwrap();
        assert!(img.width() <= 500);
        assert!(img.height() <= 500);
        let _ = std::fs::remove_file(&path);
    }
}
