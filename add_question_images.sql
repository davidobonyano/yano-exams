-- Add image support to questions table as embedded base64 data
ALTER TABLE questions ADD COLUMN image_data TEXT;

-- Add comment for documentation
COMMENT ON COLUMN questions.image_data IS 'Base64 encoded image data integrated into question display';
