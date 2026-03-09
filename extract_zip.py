
  import zipfile
  import os

  zip_path = 'attached_assets/School-Meal-Hub_1772719132013.zip'
  extract_dir = 'extracted_nextjs_app'

  os.makedirs(extract_dir, exist_ok=True)

  with zipfile.ZipFile(zip_path, 'r') as zip_ref:
      zip_ref.extractall(extract_dir)

  print('✅ ZIP extracted successfully')

  # List contents
  contents = os.listdir(extract_dir)
  print('Extracted contents:', contents)

  # If single directory, show its contents too
  if len(contents) == 1 and os.path.isdir(os.path.join(extract_dir, contents[0])):
      root_dir = os.path.join(extract_dir, contents[0])
      print(f'Root directory: {root_dir}')
      print('Root contents:', os.listdir(root_dir)[:20])  # First 20 items
  