# SALES PLAN PAGE

Modern enterprise dashboard for sales plan Excel workbook generation.

## Overview

Users upload a monthly sales plan Excel workbook and receive a professionally formatted workbook with a newly generated Sales Plan worksheet and customer summary.

## Features

- Drag and drop Excel upload
- File validation and metadata preview
- Sales plan worksheet creation with summary table
- Professional Excel formatting and calculations
- Dark/light theme toggle
- Recent file history and processing log export

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:4000`

## API Endpoints

- `POST /upload` - upload and validate source Excel workbook
- `POST /generate` - generate processed workbook and store it on the server
- `GET /download?name={filename}` - download generated workbook
- `GET /health` - server health check
