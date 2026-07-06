CREATE TABLE IF NOT EXISTS crm_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(128) NOT NULL,
  principal VARCHAR(64) NOT NULL,
  stage VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS erp_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  product_name VARCHAR(128) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  warehouse VARCHAR(64) NOT NULL,
  eta_days INT NOT NULL DEFAULT 0
);

INSERT INTO crm_leads (customer_name, principal, stage, amount, notes) VALUES
('Acme Telecom Kenya', 'DELL', 'open', 45000.00, 'Server refresh Q3'),
('Nairobi DataHub', 'DELL', 'proposal', 76000.00, 'Needs storage cluster'),
('EastNet Logistics', 'HP', 'open', 22000.00, 'Branch office rollout'),
('Mombasa Fiber', 'Microsoft', 'qualified', 15000.00, 'E5 upsell'),
('Skyline ISP', 'DELL', 'open', 98000.00, 'Core datacenter expansion');

INSERT INTO erp_inventory (sku, product_name, quantity, warehouse, eta_days) VALUES
('DELL-R750', 'Dell PowerEdge R750', 22, 'Nairobi-WH-A', 0),
('HPE-DL380', 'HPE ProLiant DL380', 10, 'Nairobi-WH-A', 2),
('ARUBA-6300', 'Aruba Switch 6300', 38, 'Kampala-WH-B', 5),
('MS-E5', 'Microsoft 365 E5 License', 500, 'License-Pool', 0),
('LEN-SR650', 'Lenovo ThinkSystem SR650', 12, 'Nairobi-WH-A', 7);
