-- Khu vực của học viên theo file điểm danh (cột "Khu Vực"), để báo cáo tách đầu Hà Nội / đầu Sài Gòn.
ALTER TABLE offline_attendance ADD COLUMN region TEXT;   -- HN | SG | KHAC
