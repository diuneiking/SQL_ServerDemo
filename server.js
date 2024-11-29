
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// // Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// // Database connection
// const db = mysql.createPool({
//   host: 'srv1627.hstgr.io',
//   user: 'u461355420_hidden',
//   password: 'Hidden@2024',
//   database: 'u461355420_hl',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });


// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request Body:', req.body);
  next();
});

// Create an HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// Broadcast function
function broadcastUpdate(update) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  });
}

app.get('/', (req, res) => {
  res.send({ message: 'Server is running' });
});

// Fetch glass status
app.get('/glass-status', (req, res) => {
  const query = 'SELECT called FROM glass_pickup_status WHERE id = 1';

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching glass status:', err);
      return res.status(500).send({ success: false, message: 'Database error' });
    }

    if (result.length > 0) {
      res.status(200).send({ success: true, called: result[0].called });
    } else {
      res.status(404).send({ success: false, message: 'Glass status not found' });
    }
  });
});

// Update the glass status
app.put('/glass-status', (req, res) => {
  const { called } = req.body;

  if (typeof called !== 'number' || (called !== 0 && called !== 1)) {
    return res.status(400).send({ success: false, message: 'Invalid status value. "called" must be 0 or 1.' });
  }

  const query = `
    UPDATE glass_pickup_status
    SET called = ?
    WHERE id = 1
  `;

  db.query(query, [called], (err) => {
    if (err) {
      console.error('Error updating glass status:', err);
      return res.status(500).send({ success: false, message: 'Error updating glass status' });
    }
    res.status(200).send({ success: true, message: 'Glass status updated successfully' });
  });
});


app.post('/login', (req, res) => {
  const { staffCode, password } = req.body;

  // Ensure staffCode and password are provided
  if (!staffCode || !password) {
    return res.status(400).send({ success: false, message: 'StaffCode and Password are required' });
  }

  const query = 'SELECT * FROM users WHERE StaffCode = ? AND Password = ?';

  // Query the database with provided staffCode and password
  db.query(query, [staffCode, password], (err, results) => {
    if (err) {
      console.error('Database query error:', err); // Log the error for debugging
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }

    // Check if a matching user is found
    if (results.length > 0) {
      const user = results[0];
      return res.status(200).send({ success: true, RoleID: user.RoleID, Name: user.Name });
    } else {
      // Send a response if the login credentials are invalid
      return res.status(401).send({ success: false, message: 'Invalid StaffCode or Password' });
    }
  });
});


// Admin login route
app.post('/admin_login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE StaffCode = ? AND Password = ? AND RoleID = 1';
  
  db.query(query, [username, password], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    if (results.length > 0) {
      res.send({ success: true });
    } else {
      res.send({ success: false, message: 'Invalid Admin Username or Password' });
    }
  });
});

// Fetch categories for Heehee branch
app.get('/heehee_categories', (req, res) => {
  const query = `
    SELECT DISTINCT items.Category
    FROM items
    WHERE items.Branch = 'Heehee' AND items.IsInactive = 0
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching Heehee categories:', err);
      res.status(500).json([]);
    } else {
      res.json(results.map(result => result.Category)); // Send only category names
    }
  });
});

// Fetch items by category and Branch = Heehee
app.get('/heehee_items/:category', (req, res) => {
  const category = req.params.category;
  const query = `
    SELECT items.*, department.DepartmentName
    FROM items
    LEFT JOIN department ON items.DepartmentID = department.DepartmentID
    WHERE items.Branch = 'Heehee' AND items.Category = ? AND items.IsInactive = 0
  `;

  db.query(query, [category], (err, results) => {
    if (err) {
      console.error('Error fetching Heehee items:', err);
      res.status(500).json([]);
    } else {
      res.json(results);
    }
  });
});


// Fetch categories sorted by CategoryID
app.get('/categories', (req, res) => {
  const query = 'SELECT * FROM categories WHERE IsInactive = 0 ORDER BY CategoryID ASC';
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch items by category
app.get('/items/:category', (req, res) => {
  const category = req.params.category;
  const query = `
    SELECT items.*, department.DepartmentName, department.DepartmentID
    FROM items 
    LEFT JOIN department ON items.DepartmentID = department.DepartmentID
    WHERE items.Category = ? AND items.IsInactive = 0
  `;
  db.query(query, [category], (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      res.status(500).json([]);
    } else {
      res.json(results);
    }
  });
});

// Fetch all items from the items table
app.get('/items', (req, res) => {
  const query = 'SELECT * FROM items WHERE IsInactive = 0';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      res.status(500).json([]);
    } else {
      res.json(results);
    }
  });
});

// Fetch modifiers
app.get('/modifiers', (req, res) => {
  const query = 'SELECT * FROM modifiers';
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch item add-ons by modifier code
app.get('/item_add_ons/:modifierCode', (req, res) => {
  const modifierCode = req.params.modifierCode;
  const query = 'SELECT * FROM item_add_ons WHERE ModifierCode = ?';
  
  db.query(query, [modifierCode], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch active discounts
app.get('/discounts', (req, res) => {
  const query = 'SELECT * FROM discounts WHERE IsActive = 1';
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Save or update order with isTakeAway
app.post('/save_order', (req, res) => {
  const { orderId, orderDate, totalPrice, items, discount, finalPrice, tableName, isTakeAway } = req.body;

  // Check if the order already exists
  const checkQuery = 'SELECT * FROM unpaid_orders WHERE OrderId = ?';
  db.query(checkQuery, [orderId], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }

    if (results.length > 0) {
      // Update existing order
      const updateQuery = `
        UPDATE unpaid_orders 
        SET OrderDate = ?, TotalPrice = ?, Items = ?, Discount = ?, FinalPrice = ?, TableName = ?, IsTakeAway = ?
        WHERE OrderId = ?
      `;
      db.query(updateQuery, [orderDate, totalPrice, JSON.stringify(items), discount, finalPrice, tableName, isTakeAway ? 1 : 0, orderId], (err, results) => {
        if (err) {
          res.status(500).send({ success: false, message: 'Database query error' });
          return;
        }
        res.send({ success: true });
      });
    } else {
      // Insert new order
      const insertQuery = `
        INSERT INTO unpaid_orders (OrderId, OrderDate, TotalPrice, Items, Discount, FinalPrice, TableName, IsTakeAway)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(insertQuery, [orderId, orderDate, totalPrice, JSON.stringify(items), discount, finalPrice, tableName, isTakeAway ? 1 : 0], (err, results) => {
        if (err) {
          res.status(500).send({ success: false, message: 'Database query error' });
          return;
        }
        res.send({ success: true });
      });
    }
  });
});


// Fetch all orders
app.get('/orders', (req, res) => {
  const query = 'SELECT * FROM unpaid_orders';
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch order details by orderId
app.get('/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const query = 'SELECT * FROM unpaid_orders WHERE OrderId = ?';

  db.query(query, [orderId], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    if (results.length > 0) {
      res.send(results[0]);
    } else {
      res.status(404).send({ success: false, message: 'Order not found' });
    }
  });
});

app.get('/unpaid_orders', (req, res) => {
  db.query('SELECT * FROM unpaid_orders', (err, results) => {
    if (err) {
      console.error('Failed to fetch unpaid orders:', err);
      return res.status(500).json({ error: 'Failed to fetch unpaid orders' });
    }
    res.json(results);
  });
});

// Delete order by orderId
app.delete('/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const query = 'DELETE FROM unpaid_orders WHERE OrderId = ?';

  db.query(query, [orderId], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    if (results.affectedRows > 0) {
      res.send({ success: true });
    } else {
      res.status(404).send({ success: false, message: 'Order not found' });
    }
  });
});

// Fetch total quantity of items sold where ShiftEnded = 1
app.get('/sales_items/total_quantity', (req, res) => {
  const query = `
    SELECT SUM(si.Quantity) AS TotalQuantity
    FROM sales_items si
    JOIN sales s ON si.SalesId = s.SalesId
    WHERE s.ShiftEnded = 1
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching total item quantity:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }

    res.json(results);
  });
});

// Fetch total number of customers where ShiftEnded = 1
app.get('/sales_items/total_customers', (req, res) => {
  const query = `
    SELECT COUNT(DISTINCT s.SalesId) AS TotalCustomers
    FROM sales s
    WHERE s.ShiftEnded = 1
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching total customers:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }

    res.json(results);
  });
});

// Voiding an item
app.post('/void_item', (req, res) => {
  const { orderId, voidDetails, voidDate, reason } = req.body;

  const insertQuery = `
    INSERT INTO voided_items (OrderId, VoidDetails, VoidDate, Reason)
    VALUES (?, ?, ?, ?)
  `;
  db.query(insertQuery, [orderId, voidDetails, voidDate, reason], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send({ success: true });
  });
});

// Fetch voided items by EndedDay
app.get('/voided_items', (req, res) => {
  const query = `SELECT * FROM voided_items WHERE EndedDay = 0`;

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch all printers
app.get('/printers', (req, res) => {
  const query = 'SELECT * FROM printers';

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Add a new printer
app.post('/printers', (req, res) => {
  const { IpAddress } = req.body;
  const query = 'INSERT INTO printers (IpAddress) VALUES (?)';

  db.query(query, [IpAddress], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send({ success: true, printerId: results.insertId });
  });
});
// Fetch all departments
app.get('/departments', (req, res) => {
  const query = 'SELECT * FROM department';

  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Update printer with name and other details
app.post('/update_printer', (req, res) => {
  const { printerId, printerName, departmentIds, isOrderSlipPrinter, isReceiptPrinter } = req.body;

  if (!Array.isArray(departmentIds)) {
    return res.status(400).send({ error: 'Invalid department IDs' });
  }

  const query = `
    UPDATE printers 
    SET PrinterName = ?, DepartmentID = ?, IsOrderSlipPrinter = ?, IsReceiptPrinter = ? 
    WHERE PrinterID = ?`;

  db.query(
    query,
    [
      printerName,
      departmentIds[0] || null, // Use the first department ID, or null if empty
      isOrderSlipPrinter,
      isReceiptPrinter,
      printerId,
    ],
    (err, result) => {
      if (err) {
        console.error('Failed to update printer:', err);
        return res.status(500).send({ error: 'Failed to update printer' });
      }
      res.send({ success: true });
    }
  );
});

app.delete('/delete_printer/:printerId', (req, res) => {
  const printerId = req.params.printerId;

  const query = 'DELETE FROM printers WHERE PrinterID = ?';

  db.query(query, [printerId], (err, result) => {
    if (err) {
      console.error('Failed to delete printer:', err);
      return res.status(500).send({ error: 'Failed to delete printer' });
    }

    res.send({ success: true });
  });
});
// Fetch service charge settings
app.get('/service_charge', (req, res) => {
  const query = 'SELECT * FROM settings WHERE SettingName IN ("ServiceChargeEnabled", "ServiceChargePercentage")';
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    
    // Process the results to return a structured response
    const serviceChargeSettings = {};
    results.forEach(row => {
      serviceChargeSettings[row.SettingName] = row.SettingValue;
    });

    res.send(serviceChargeSettings);
  });
});
// Fetch payment methods
app.get('/payment_methods', (req, res) => {
  const query = 'SELECT * FROM payment_methods WHERE IsActive = 1'; // Fetch only active payment methods

  db.query(query, (err, results) => {
      if (err) {
          console.error('Failed to fetch payment methods:', err);
          return res.status(500).json({ error: 'Failed to fetch payment methods' });
      }
      res.json(results);
  });
});

app.post('/insert_sales_data', (req, res) => {
  const {
    orderId,
    orderItems,
    totalPrice,
    paymentDetails,
    discount,
    serviceCharge,
    rounding,
    completedBy: userName,
    tableName,
    isTakeAway,
    discountCode,
    discountName,
    discountType,
    tenderedCash,
    changes
  } = req.body;

  if (!userName) {
    console.error('CompletedBy (userName) is null or undefined');
    return res.status(400).send('CompletedBy field is required');
  }

  if (!orderItems || orderItems.length === 0) {
    console.error('Order items are empty');
    return res.status(400).send('Order items cannot be empty');
  }

  const calculatedServiceCharge = isTakeAway ? 0 : serviceCharge;
  console.log('Received Order Items:', orderItems);

  const insertSalesQuery = `
    INSERT INTO sales (
      OrderID, OrderDate, TotalPrice, FinalPrice, PaymentDetails, Discount, 
      ServiceCharge, Rounding, CompletedBy, TableName, IsTakeAway, discountCode, 
      discountName, discountType, TenderedCash, Changes
    ) 
    VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const totalItemPrice = orderItems.reduce((sum, item) => sum + item.Price * item.Quantity, 0);
  const finalPrice = totalItemPrice - discount + calculatedServiceCharge + rounding;

  db.getConnection((err, connection) => {
    if (err) {
      console.error('Failed to get database connection:', err);
      return res.status(500).send('Failed to connect to database');
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Failed to begin transaction:', err);
        connection.release();
        return res.status(500).send('Failed to begin transaction');
      }

      connection.query(insertSalesQuery, [
        orderId,
        totalItemPrice,
        finalPrice,
        JSON.stringify(paymentDetails),
        discount,
        calculatedServiceCharge,
        rounding,
        userName,
        tableName,
        isTakeAway ? 1 : 0,
        discountCode,
        discountName,
        discountType,
        tenderedCash,
        changes
      ], (err, result) => {
        if (err) {
          console.error('Failed to insert into sales:', err);
          return connection.rollback(() => {
            connection.release();
            res.status(500).send('Failed to insert sales data');
          });
        }

        const salesId = result.insertId;

        const insertSalesItemsPromises = orderItems.map((item) => {
          const insertSalesItemsQuery = `
            INSERT INTO sales_items (
              SalesId, ItemCode, ItemName, Quantity, Price, OrderID, Remark, ModifierCode, AddOns, IsTakeAway
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          return new Promise((resolve, reject) => {
            connection.query(insertSalesItemsQuery, [
              salesId,
              item.ItemCode,
              item.ItemName,
              item.Quantity,
              item.Price,
              orderId,
              item.Remark || '',
              item.ModifierCode || '',
              JSON.stringify(item.SelectedAddOns || []),
              isTakeAway ? 1 : 0
            ], (err, result) => {
              if (err) {
                console.error('Failed to insert into sales_items:', err);
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        });

        Promise.all(insertSalesItemsPromises)
          .then(() => {
            const insertInvoicesQuery = `
              INSERT INTO invoices (
                OrderID, TotalPrice, PaymentDetails, Discount, ServiceCharge, Rounding, 
                ItemsDetails, CompletedBy, NetTotal, Timestamp, TableName, IsTakeAway, 
                discountCode, discountName, discountType, TenderedCash, Changes
              ) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
            `;

            const orderItemsJson = JSON.stringify(
              orderItems.map((item) => ({
                ...item,
                SelectedAddOns: item.SelectedAddOns || []
              }))
            );

            connection.query(insertInvoicesQuery, [
              orderId,
              totalItemPrice,
              JSON.stringify(paymentDetails),
              discount,
              serviceCharge,
              rounding,
              orderItemsJson,
              userName,
              finalPrice,
              tableName,
              isTakeAway ? 1 : 0,
              discountCode,
              discountName,
              discountType,
              tenderedCash,
              changes
            ], (err, result) => {
              if (err) {
                console.error('Failed to insert into invoices:', err);
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).send('Failed to insert invoices');
                });
              }

              connection.commit((err) => {
                if (err) {
                  console.error('Failed to commit transaction:', err);
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).send('Failed to commit transaction');
                  });
                }

                connection.release();
                res.status(200).send('Sales data inserted successfully');
              });
            });
          })
          .catch((err) => {
            console.error('Error processing sales items:', err);
            return connection.rollback(() => {
              connection.release();
              res.status(500).send('Failed to insert sales items');
            });
          });
      });
    });
  });
});

// Insert into heehee_order table
app.post('/heehee_orders/saveOrUpdate', (req, res) => {
  const {
    OrderId,
    OrderDate,
    TotalPrice,
    Items,
    Discount,
    FinalPrice,
    Ordered,
    TableName,
    IsTakeAway,
  } = req.body;

  // Set Branch as "Heehee" by default
  const Branch = "Heehee";

  // Ensure mandatory fields are provided
  if (!OrderId) {
    return res.status(400).send('OrderId is required');
  }

  // Prepare the SQL query
  const query = `
    INSERT INTO heehee_order (
      OrderId,
      OrderDate,
      TotalPrice,
      Items,
      Discount,
      FinalPrice,
      Ordered,
      TableName,
      IsTakeAway,
      Branch
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      OrderDate = VALUES(OrderDate),
      TotalPrice = VALUES(TotalPrice),
      Items = VALUES(Items),
      Discount = VALUES(Discount),
      FinalPrice = VALUES(FinalPrice),
      Ordered = VALUES(Ordered),
      TableName = VALUES(TableName),
      IsTakeAway = VALUES(IsTakeAway),
      Branch = VALUES(Branch)
  `;
  
  // Execute the query
  db.query(
    query,
    [
      OrderId,
      OrderDate,
      TotalPrice,
      JSON.stringify(Items), // Save Items as JSON string
      Discount,
      FinalPrice,
      Ordered ? 1 : 0,
      TableName || null,
      IsTakeAway ? 1 : 0,
      Branch, // Always insert as "Heehee"
    ],
    (err, result) => {
      if (err) {
        console.error('Failed to insert or update heehee_order:', err);
        return res.status(500).send('Failed to insert or update heehee_order');
      }

      res.status(200).send({ success: true, message: 'Order processed successfully' });
    }
  );
});

// Move order from heehee_order to heehee_done
app.post('/move_order_to_done', (req, res) => {
  const { OrderId } = req.body;

  if (!OrderId) {
    return res.status(400).send('OrderId is required');
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('Failed to get database connection:', err);
      return res.status(500).send('Failed to connect to database');
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Failed to begin transaction:', err);
        connection.release();
        return res.status(500).send('Failed to begin transaction');
      }

      // Fetch the order from heehee_order
      const selectQuery = `SELECT * FROM heehee_order WHERE OrderId = ?`;
      connection.query(selectQuery, [OrderId], (err, results) => {
        if (err) {
          console.error('Failed to fetch order from heehee_order:', err);
          return connection.rollback(() => {
            connection.release();
            res.status(500).send('Failed to fetch order from heehee_order');
          });
        }

        if (results.length === 0) {
          console.error(`Order with OrderId ${OrderId} not found in heehee_order`);
          return connection.rollback(() => {
            connection.release();
            res.status(404).send('Order not found');
          });
        }

        const orderData = results[0];

        // Insert the order into heehee_done
        const insertDoneQuery = `
          INSERT INTO heehee_done (
            OrderId, OrderDate, TotalPrice, Items, Discount, FinalPrice,
            Ordered, TableName, IsTakeAway, Branch
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        connection.query(
          insertDoneQuery,
          [
            orderData.OrderId,
            orderData.OrderDate,
            orderData.TotalPrice,
            orderData.Items,
            orderData.Discount,
            orderData.FinalPrice,
            orderData.Ordered,
            orderData.TableName,
            orderData.IsTakeAway,
            orderData.Branch,
          ],
          (err, result) => {
            if (err) {
              console.error('Failed to insert into heehee_done:', err);
              return connection.rollback(() => {
                connection.release();
                res.status(500).send('Failed to move order to heehee_done');
              });
            }

            // Delete the order from heehee_order
            const deleteQuery = `DELETE FROM heehee_order WHERE OrderId = ?`;
            connection.query(deleteQuery, [OrderId], (err, result) => {
              if (err) {
                console.error('Failed to delete order from heehee_order:', err);
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).send('Failed to delete order from heehee_order');
                });
              }

              // Commit the transaction
              connection.commit((err) => {
                if (err) {
                  console.error('Failed to commit transaction:', err);
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).send('Failed to commit transaction');
                  });
                }

                connection.release();
                res.status(200).send({
                  success: true,
                  message: `Order with OrderId ${OrderId} moved to heehee_done successfully`,
                });
              });
            });
          }
        );
      });
    });
  });
});


app.post('/heehee_orders/delete', (req, res) => {
  const { TableName } = req.body;

  if (!TableName) {
    return res.status(400).send('TableName is required');
  }

  const query = `DELETE FROM heehee_order WHERE TableName = ?`;

  db.query(query, [TableName], (err, result) => {
    if (err) {
      console.error('Failed to delete Heehee order:', err);
      return res.status(500).send('Failed to delete Heehee order');
    }

    if (result.affectedRows > 0) {
      res.status(200).send({ success: true });
    } else {
      res.status(404).send({ success: false, message: 'No order found to delete' });
    }
  });
});

app.get('/heehee_orders/fetchAll', (req, res) => {
  const query = `
    SELECT * FROM heehee_order
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch Heehee orders:', err);
      return res.status(500).send('Failed to fetch Heehee orders');
    }

    res.status(200).send(results);
  });
});

// Fetch all records from heehee_done table
app.get('/heehee_done/fetchAll', (req, res) => {
  const query = `
    SELECT * FROM heehee_done
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch Heehee done orders:', err);
      return res.status(500).send('Failed to fetch Heehee done orders');
    }

    res.status(200).send(results);
  });
});

app.delete('/unpaid_orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  const query = 'DELETE FROM unpaid_orders WHERE OrderId = ?';
  db.query(query, [orderId], (err, result) => {
    if (err) {
      console.error('Failed to delete unpaid order:', err);
      return res.status(500).send('Failed to delete unpaid order');
    }

    if (result.affectedRows > 0) {
      res.send('Unpaid order deleted successfully');
    } else {
      res.status(404).send('Order not found');
    }
  });
});

app.post('/reverse_order', (req, res) => {
  const { orderId } = req.body;

  // Query the invoice details before deleting
  const selectInvoiceQuery = `SELECT * FROM invoices WHERE OrderID = ?`;

  db.query(selectInvoiceQuery, [orderId], (err, results) => {
    if (err) {
      console.error('Failed to fetch invoice details:', err);
      return res.status(500).send('Failed to fetch invoice details');
    }

    if (results.length === 0) {
      return res.status(404).send('Invoice not found');
    }

    const invoice = results[0];

    // Convert ItemsDetails to match normal unpaid order format
    let itemsDetails = JSON.parse(invoice.ItemsDetails);
    itemsDetails = itemsDetails.map(item => ({
      itemCode: item.ItemCode,
      itemName: item.ItemName,
      price: item.Price,
      quantity: item.Quantity,
      remark: item.Remark,
      selectedAddOns: item.SelectedAddOns || [],
    }));

    // Calculate the TotalPrice and FinalPrice without discounts and service charges
    const totalPrice = itemsDetails.reduce((total, item) => total + (item.price * item.quantity), 0);
    const finalPrice = totalPrice;

    // Proceed to delete from sales_items, sales, and invoices
    const deleteSalesItemsQuery = `
      DELETE FROM sales_items 
      WHERE OrderID = ?`;

    db.query(deleteSalesItemsQuery, [orderId], (err, result) => {
      if (err) {
        console.error('Failed to delete from sales_items:', err);
        return res.status(500).send('Failed to delete from sales_items');
      }

      const deleteSalesQuery = `
        DELETE FROM sales 
        WHERE OrderID = ?`;

      db.query(deleteSalesQuery, [orderId], (err, result) => {
        if (err) {
          console.error('Failed to delete from sales:', err);
          return res.status(500).send('Failed to delete from sales');
        }

        const deleteInvoicesQuery = `
          DELETE FROM invoices 
          WHERE OrderID = ?`;

        db.query(deleteInvoicesQuery, [orderId], (err, result) => {
          if (err) {
            console.error('Failed to delete from invoices:', err);
            return res.status(500).send('Failed to delete from invoices');
          }

          // After deletion, insert the order details back into unpaid_orders
          const insertUnpaidOrderQuery = `
            INSERT INTO unpaid_orders (OrderID, OrderDate, TotalPrice, Items, Discount, FinalPrice, TableName, IsTakeAway)
            VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)
          `;

          db.query(insertUnpaidOrderQuery, [
            invoice.OrderID,
            totalPrice, // Use calculated totalPrice
            JSON.stringify(itemsDetails), // Insert normalized itemsDetails
            invoice.Discount, // Keep the original discount value
            finalPrice, // Use the same calculated value as FinalPrice
            invoice.TableName  // Use the TableName from the original invoice
          ], (err, result) => {
            if (err) {
              console.error('Failed to insert back into unpaid_orders:', err);
              return res.status(500).send('Failed to insert back into unpaid_orders');
            }

            res.status(200).send('Order reversed and reinserted into unpaid orders successfully');
          });
        });
      });
    });
  });
});


//fetch invoices
app.get('/invoices/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
  const query = `SELECT * FROM invoices WHERE DATE(Timestamp) = ?`;
  
  db.query(query, [today], (err, results) => {
    if (err) {
      console.error('Error fetching invoices:', err);
      res.status(500).json([]);
    } else {
      res.json(results);
    }
  });
});

app.get('/invoices/all', (req, res) => {

  const query = `SELECT * FROM invoices`; // Fetch all invoices without any date filter

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing SQL query:', err);
      return res.status(500).json({ message: 'Failed to fetch invoices' });
    }


    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No invoices found' });
    }

    res.status(200).json(results);
  });
});


app.get('/invoices/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const query = 'SELECT * FROM invoices WHERE OrderID = ?';

  db.query(query, [orderId], (err, results) => {
    if (err) {
      console.error('Error fetching invoice:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    if (results.length > 0) {
      res.send(results[0]);
    } else {
      res.status(404).send({ success: false, message: 'Invoice not found' });
    }
  });
});


app.post('/reprint_invoice', (req, res) => {
  const { reprintId } = req.body;

  const query = 'SELECT * FROM reprint_invoices WHERE reprint_id = ?';
  db.query(query, [reprintId], (err, results) => {
    if (err) {
      console.error('Failed to fetch reprint invoice:', err);
      return res.status(500).send('Failed to fetch reprint invoice');
    }

    if (results.length > 0) {
      const invoiceDetails = results[0].invoice_details;
      const isTakeAway = results[0].IsTakeAway;
      const invoice = JSON.parse(invoiceDetails);

      res.status(200).send('Reprint invoice initiated successfully');
    } else {
      res.status(404).send('Reprint invoice not found');
    }
  });
});


app.get('/reprint_invoices/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const query = 'SELECT * FROM reprint_invoices WHERE order_id = ?';

  db.query(query, [orderId], (err, results) => {
    if (err) {
      console.error('Error fetching reprint invoice:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    if (results.length > 0) {
      res.send(results[0]);
    } else {
      res.status(404).send({ success: false, message: 'Reprint invoice not found' });
    }
  });
});

// Insert a new payout
app.post('/insert_payout', (req, res) => {
  const { payoutTo, payoutAmount, recordedBy, payoutTimeDate, isEndOfDay } = req.body;
  
  const query = `
    INSERT INTO payouts (PayoutTo, PayoutAmount, RecordedBy, PayoutTimeDate, IsEndOfDay)
    VALUES (?, ?, ?, ?, 0)
  `;
  
  db.query(query, [payoutTo, payoutAmount, recordedBy, payoutTimeDate, isEndOfDay], (err, result) => {
    if (err) {
      console.error('Failed to insert payout:', err);
      return res.status(500).send({ success: false, message: 'Failed to insert payout' });
    }
    res.send({ success: true, payoutId: result.insertId });
  });
});

// Update backend route to handle selected date
app.get('/payouts/today', (req, res) => {
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0]; // Default to today's date if no date is provided
  const query = `SELECT * FROM payouts WHERE DATE(PayoutTimeDate) = ?`;

  db.query(query, [selectedDate], (err, results) => {
    if (err) {
      console.error('Error fetching payouts:', err);
      res.status(500).json({ success: false, message: 'Database query error' });
      return;
    }
    res.json(results);
  });
});


// Add a new item
app.post('/items', (req, res) => {
  const {
    ItemCode,
    ItemName,
    Price,
    Category,
    SKU,
    DepartmentName,
    DepartmentID,
    Inventory,
    IsInactive,
    ModifierCode
  } = req.body;

  const query = `
    INSERT INTO items 
    (ItemCode, ItemName, Price, Category, SKU, DepartmentName, DepartmentID, Inventory, IsInactive, ModifierCode) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      ItemCode,
      ItemName,
      Price,
      Category,
      SKU || null,  // Use null if SKU is not provided
      DepartmentName,
      DepartmentID,
      Inventory || null,  // Use null if Inventory is not provided
      IsInactive,
      ModifierCode || null // Use null if ModifierCode is not provided
    ],
    (err, results) => {
      if (err) {
        console.error('Failed to insert new item:', err);
        return res.status(500).send({ success: false, message: 'Failed to insert new item' });
      }
      res.send({ success: true, itemId: results.insertId });
    }
  );
});

// Fetch an item by ItemCode
app.get('/items/:itemCode', (req, res) => {
  const itemCode = req.params.itemCode;

  const query = `
    SELECT * FROM items WHERE ItemCode = ?
  `;
  db.query(query, [itemCode], (err, results) => {
    if (err) {
      console.error('Failed to fetch item:', err);
      return res.status(500).send({ success: false, message: 'Failed to fetch item' });
    }
    if (results.length > 0) {
      res.send(results[0]);
    } else {
      res.status(404).send({ success: false, message: 'Item not found' });
    }
  });
});

// Update an existing item
app.put('/items/:itemCode', (req, res) => {
  const itemCode = req.params.itemCode;
  const {
    ItemName,
    Price,
    Category,
    SKU,
    DepartmentName,
    DepartmentID,
    Inventory,
    IsInactive,
    ModifierCode
  } = req.body;

  const query = `
    UPDATE items
    SET ItemName = ?, Price = ?, Category = ?, SKU = ?, DepartmentName = ?, DepartmentID = ?, Inventory = ?, IsInactive = ?, ModifierCode = ?
    WHERE ItemCode = ?
  `;
  
  db.query(
    query,
    [
      ItemName,
      Price,
      Category,
      SKU || null,
      DepartmentName,
      DepartmentID,
      Inventory || null,
      IsInactive,
      ModifierCode || null,
      itemCode
    ],
    (err, results) => {
      if (err) {
        console.error('Failed to update item:', err);
        return res.status(500).send({ success: false, message: 'Failed to update item' });
      }
      res.send({ success: true });
    }
  );
});

// Fetch company details
app.get('/company_info', (req, res) => {
  const query = 'SELECT * FROM company_info';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch company details:', err);
      return res.status(500).send({ success: false, message: 'Failed to fetch company details' });
    }
    res.send(results);
  });
});

app.post('/add_user', (req, res) => {
  const { StaffCode, Password, Name, Role, RoleID, Team, CardNumber } = req.body;

  const sql = `
    INSERT INTO users (StaffCode, Password, Name, Role, RoleID, Team, CardNumber)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [StaffCode, Password, Name, Role, RoleID, Team, CardNumber], (err, result) => {
    if (err) {
      console.error('Error inserting user:', err);
      res.status(500).json({ success: false, message: 'Failed to insert user' });
      return;
    }
    res.status(200).json({ success: true, message: 'User inserted successfully' });
  });
});

// Endpoint to create a new user
app.post('/create_user', (req, res) => {
  const { staffCode, password, name, role, roleID, team, cardNumber } = req.body;

  const query = `
    INSERT INTO users (StaffCode, Password, Name, Role, RoleID, Team, CardNumber)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [staffCode, password, name, role, roleID, team, cardNumber],
    (err, result) => {
      if (err) {
        console.error('Failed to insert user:', err);
        res.status(500).json({ success: false, message: 'Failed to create user' });
        return;
      }
      res.json({ success: true, message: 'User created successfully' });
    }
  );
});

// Endpoint to fetch teams
app.get('/teams', (req, res) => {
  const query = 'SELECT TeamID, TeamName FROM team';

  // Use the 'db' connection instead of 'pool'
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    } else {
      res.json(results);
    }
  });
});

// Endpoint to fetch all users
app.get('/users', (req, res) => {
  const query = 'SELECT * FROM users';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch users' });
    } else {
      res.json(results);
    }
  });
});

app.get('/sales/:completedBy', (req, res) => {
  const completedBy = req.params.completedBy;
  const query = `
    SELECT * FROM sales WHERE CompletedBy = ? AND ShiftEnded = 0
  `;

  db.query(query, [completedBy], (err, results) => {
    if (err) {
      console.error('Failed to fetch sales:', err);
      return res.status(500).send({ success: false, message: 'Failed to fetch sales' });
    }
    res.send(results);
  });
});

app.put('/sales/end_shift/:completedBy', (req, res) => {
  const completedBy = req.params.completedBy;
  const query = `
    UPDATE sales SET ShiftEnded = 1 WHERE CompletedBy = ? AND ShiftEnded = 0
  `;

  db.query(query, [completedBy], (err, result) => {
    if (err) {
      console.error('Failed to update ShiftEnded status:', err);
      return res.status(500).send({ success: false, message: 'Failed to update ShiftEnded status' });
    }
    res.send({ success: true, message: 'Shift ended successfully' });
  });
});

app.get('/sales', (req, res) => {
  const shiftEnded = req.query.shiftEnded; // Get the shiftEnded parameter from the query string

  const query = 'SELECT * FROM sales WHERE ShiftEnded = ?';
  
  db.query(query, [shiftEnded], (err, results) => {
    if (err) {
      console.error('Failed to fetch sales:', err);
      res.status(500).json({ success: false, message: 'Database query error' });
    } else {
      res.json(results);
    }
  });
});

// Endpoint to fetch payouts with IsEndOfDay and ShiftEnded status
app.get('/payouts', (req, res) => {
  const isEndOfDay = req.query.isEndOfDay; // Get the isEndOfDay parameter from the query string
  const shiftEnded = req.query.shiftEnded; // Get the shiftEnded parameter from the query string

  const query = 'SELECT * FROM payouts WHERE ShiftEnded = ? AND IsEndOfDay = ?';

  // Correctly pass both parameters in a single array
  db.query(query, [shiftEnded, isEndOfDay], (err, results) => {
    if (err) {
      console.error('Failed to fetch payouts:', err);
      res.status(500).json({ success: false, message: 'Database query error' });
    } else {
      res.json(results);
    }
  });
});


// Endpoint to end shift and insert details into shift_end table
app.post('/end_shift', (req, res) => {
 
  const {
    completedBy,
    totalSales,
    cashSales,
    declaredCash,
    discrepancy,
    totalPayouts,
    shiftEndTime,
    serviceCharge,  // New field
    billDiscount    // New field
  } = req.body;

  const query = `
    INSERT INTO shift_end (UserName, TotalSales, CashSales, DeclaredCash, Discrepancy, TotalPayouts, ShiftEndTime, ServiceCharge, BillDiscount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [completedBy, totalSales, cashSales, declaredCash, discrepancy, totalPayouts, shiftEndTime, serviceCharge, billDiscount], (err, result) => {
    if (err) {
      console.error('Failed to end shift:', err);
      res.status(500).send('Failed to end shift');
    } else {
      res.send({ success: true, message: 'Shift ended successfully' });
    }
  });
});


// Endpoint to update sales shiftEnded status
app.put('/update_sales_shift_ended', (req, res) => {
  const { completedBy, shiftEnded } = req.body;

  const query = `
    UPDATE sales 
    SET ShiftEnded = ? 
    WHERE CompletedBy = ? AND ShiftEnded = 0
  `;

  db.query(query, [shiftEnded, completedBy], (err, result) => {
    if (err) {
      console.error('Failed to update sales shiftEnded status:', err);
      res.status(500).send('Failed to update sales shiftEnded status');
    } else {
      res.send({ success: true, message: 'Sales shiftEnded status updated successfully' });
    }
  });
});

// Endpoint to update ShiftEnded status in payouts
app.put('/update_payouts_shift_ended', (req, res) => {
  const { recordedBy, shiftEnded } = req.body; // Corrected variable name

  const query = `
    UPDATE payouts 
    SET ShiftEnded = ? 
    WHERE RecordedBy = ? AND ShiftEnded = 0
  `;

  db.query(query, [shiftEnded, recordedBy], (err, result) => {
    if (err) {
      console.error('Failed to update payouts ShiftEnded status:', err);
      res.status(500).send('Failed to update payouts ShiftEnded status');
    } else {
      res.send({ success: true, message: 'Payouts ShiftEnded status updated successfully' });
    }
  });
});


// Endpoint to update IsEndOfDay status in payouts
app.put('/update_payouts_is_end_of_day', (req, res) => {
  const { recordedBy, isEndOfDay } = req.body;

  const query = `
    UPDATE payouts 
    SET IsEndOfDay = ? 
    WHERE RecordedBy = ? AND IsEndOfDay = 0
  `;

  db.query(query, [isEndOfDay, recordedBy], (err, result) => {
    if (err) {
      console.error('Failed to update payouts IsEndOfDay status:', err);
      res.status(500).send('Failed to update payouts IsEndOfDay status');
    } else {
      res.send({ success: true, message: 'Payouts IsEndOfDay status updated successfully' });
    }
  });
});

// Fetch all shifts not ended, grouped by UserName
app.get('/shift_end/not_ended', (req, res) => {
  const query = `
    SELECT * FROM shift_end 
    WHERE Ended = 0;
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch not ended shifts:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Fetch all shifts that have ended, grouped by UserName
app.get('/shift_end/ended', (req, res) => {
  const query = `
    SELECT * FROM shift_end 
    WHERE Ended = 1;
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch ended shifts:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});


// Fetch sales where IsEndOfDay = 0
app.get('/sales/not-ended', (req, res) => {
  const query = 'SELECT * FROM sales WHERE IsEndOfDay = 0';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Failed to fetch sales data:', err);
      res.status(500).json({ error: 'Failed to fetch sales data' });
    } else {
      res.json(results);
    }
  });
});

// Endpoint to update ShiftEnded status in invoices
app.put('/update_invoices_shift_ended', (req, res) => {
  const { completedBy, shiftEnded } = req.body;

  const query = `
    UPDATE invoices
    SET ShiftEnded = ?
    WHERE CompletedBy = ? AND ShiftEnded = 0
  `;

  db.query(query, [shiftEnded, completedBy], (err, result) => {
    if (err) {
      console.error('Failed to update invoices ShiftEnded status:', err);
      res.status(500).send('Failed to update invoices ShiftEnded status');
    } else {
      res.send({ success: true, message: 'Invoices ShiftEnded status updated successfully' });
    }
  });
});

// Endpoint to update the ServiceChargeEnabled setting
app.put('/update_service_charge', (req, res) => {
  const { enabled } = req.body;
  const query = 'UPDATE settings SET SettingValue = ? WHERE SettingName = "ServiceChargeEnabled"';

  db.query(query, [enabled], (err, result) => {
    if (err) {
      console.error('Failed to update ServiceChargeEnabled setting:', err);
      return res.status(500).send({ success: false, message: 'Failed to update setting' });
    }
    res.send({ success: true, message: 'ServiceChargeEnabled setting updated successfully' });
  });
});

// ==========================
// Zone Management Endpoints
// ==========================

// Fetch all zones
app.get('/zones', (req, res) => {
  const query = 'SELECT * FROM zones';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching zones:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});


// Create a new zone
app.post('/zones', (req, res) => {
  const { name } = req.body;
  const query = 'INSERT INTO zones (name) VALUES (?)';

  db.query(query, [name], (err, result) => {
    if (err) {
      console.error('Failed to insert zone:', err);
      res.status(500).send({ success: false, message: 'Failed to insert zone' });
      return;
    }
    res.send({ success: true, zoneId: result.insertId });
  });
});

// Update a zone name
app.put('/zones/:id', (req, res) => {
  const zoneId = req.params.id;
  const { name } = req.body;
  const query = 'UPDATE zones SET name = ? WHERE id = ?';

  db.query(query, [name, zoneId], (err, result) => {
    if (err) {
      console.error('Failed to update zone:', err);
      res.status(500).send({ success: false, message: 'Failed to update zone' });
      return;
    }
    res.send({ success: true });
  });
});

// Delete a zone
app.delete('/zones/:id', (req, res) => {
  const zoneId = req.params.id;
  const query = 'DELETE FROM zones WHERE id = ?';

  db.query(query, [zoneId], (err, result) => {
    if (err) {
      console.error('Failed to delete zone:', err);
      res.status(500).send({ success: false, message: 'Failed to delete zone' });
      return;
    }
    res.send({ success: true });
  });
});

// ==========================
// Table Management Endpoints
// ==========================

// Fetch all tables in a zone
app.get('/zones/:zoneId/tables', (req, res) => {
  const zoneId = req.params.zoneId;
  const query = 'SELECT * FROM tables WHERE zone_id = ?';

  db.query(query, [zoneId], (err, results) => {
    if (err) {
      console.error('Error fetching tables:', err);
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    res.send(results);
  });
});

// Create a new table in a zone
app.post('/zones/:zoneId/tables', (req, res) => {
  const zoneId = req.params.zoneId;
  const { name, width, height, x_position, y_position, status, shape } = req.body; // Include shape
  const query = `
    INSERT INTO tables (zone_id, name, width, height, x_position, y_position, status, shape) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [zoneId, name, width, height, x_position, y_position, status, shape], (err, result) => { // Include shape
    if (err) {
      console.error('Failed to insert table:', err);
      res.status(500).send({ success: false, message: 'Failed to insert table' });
      return;
    }
    res.send({ success: true, tableId: result.insertId });
  });
});


// Update a table
app.put('/tables/:id', (req, res) => {
  const tableId = req.params.id;
  const { name, width, height, x_position, y_position, status, shape } = req.body; // Include shape
  const query = `
    UPDATE tables 
    SET name = ?, width = ?, height = ?, x_position = ?, y_position = ?, status = ?, shape = ? 
    WHERE id = ?
  `;

  db.query(query, [name, width, height, x_position, y_position, status, shape, tableId], (err, result) => { // Include shape
    if (err) {
      console.error('Failed to update table:', err);
      res.status(500).send({ success: false, message: 'Failed to update table' });
      return;
    }
    res.send({ success: true });
  });
});


// Delete a table
app.delete('/tables/:id', (req, res) => {
  const tableId = req.params.id;
  const query = 'DELETE FROM tables WHERE id = ?';

  db.query(query, [tableId], (err, result) => {
    if (err) {
      console.error('Failed to delete table:', err);
      res.status(500).send({ success: false, message: 'Failed to delete table' });
      return;
    }
    res.send({ success: true });
  });
});

// Endpoint to update the table name of an existing order
app.put('/update_order_table_name', (req, res) => {
  const { orderId, newTableName } = req.body; // Extract orderId and newTableName from request body

  // SQL query to update the table name for the given order ID
  const query = 'UPDATE unpaid_orders SET TableName = ? WHERE OrderId = ?';

  db.query(query, [newTableName, orderId], (err, result) => {
    if (err) {
      console.error('Error updating table name:', err);
      return res.status(500).send({ success: false, message: 'Failed to update table name' });
    }

    if (result.affectedRows > 0) {
      res.send({ success: true, message: 'Table name updated successfully' });
    } else {
      res.status(404).send({ success: false, message: 'Order not found' });
    }
  });
});

// Endpoint to check if a day entry exists for today
app.get('/check_day_entry_exists', (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format
  const query = `SELECT COUNT(*) AS count FROM end_day WHERE DATE(StartTime) = ?`;
  
  db.query(query, [today], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }
    
    const exists = results[0].count > 0;
    res.send({ exists });
  });
});

// Endpoint to insert a new day entry
app.post('/insert_new_day_entry', (req, res) => {
  const { startTime } = req.body;

  // Insert query assuming DayID is auto-increment
  const query = `INSERT INTO end_day (StartTime) VALUES (?)`;

  db.query(query, [startTime], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database insertion error' });
      return;
    }
    
    // If you need to return the inserted row or the newly inserted DayID
    res.send({ success: true, dayId: results.insertId });
  });
});

// Endpoint to check if a day entry exists for today
app.get('/check_if_day_exists', (req, res) => {
  const today = new Date().toISOString().slice(0, 10); // Get today's date (YYYY-MM-DD)
  const query = `SELECT DayID FROM end_day WHERE DATE(StartTime) = ?`;

  db.query(query, [today], (err, results) => {
    if (err) {
      res.status(500).send({ success: false, message: 'Database query error' });
      return;
    }

    if (results.length > 0) {
      res.send({ success: true, dayExists: true, dayID: results[0].DayID });
    } else {
      res.send({ success: true, dayExists: false });
    }
  });
});


// Endpoint to check unfinished day
app.get('/checkUnfinishedDay', (req, res) => {
  const query = `
    SELECT *
    FROM end_day
    WHERE IsClosed = 0
      AND StartTime < CURDATE()
  `;

  db.query(query, (error, results) => {
    if (error) {
      console.error('Error checking for unfinished day:', error);
      res.status(500).json({ error: 'Database query failed' });
      return;
    }

    // If there's any result, it means there's an unfinished day
    const hasUnfinishedDay = results.length > 0;

    res.json({ hasUnfinishedDay });
  });
});

// Fetch total payouts with ShiftEnded = 1 and IsEndOfDay = 0
app.get('/payouts/totals', (req, res) => {
  const query = `
    SELECT SUM(TotalPayouts) AS totalPayouts
    FROM payouts
    WHERE ShiftEnded = 1 AND IsEndOfDay = 0
  `;
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json({ totalPayouts: results[0].totalPayouts });
    }
  });
});

// Insert into end_day table with EndTime included
app.post('/end_day', (req, res) => {
  const { 
    cashCollection, 
    totalSales, 
    totalPayouts, 
    totalCash, 
    billDiscount, 
    serviceCharge, 
    paymentDetails,
    dayID // Added DayID to the request body
  } = req.body;
  
  const query = `
  UPDATE end_day
  SET 
    EndTime = NOW(), 
    CashCollection = ?, 
    TotalSales = ?, 
    TotalPayouts = ?, 
    TotalCash = ?, 
    BillDiscount = ?, 
    ServiceCharge = ?, 
    PaymentDetails = ?, 
    IsClosed = 1
  WHERE DayID = ?; -- Use DayID to target the correct row
  `;
  
  db.query(query, [
    cashCollection, 
    totalSales, 
    totalPayouts, 
    totalCash, 
    billDiscount, 
    serviceCharge, 
    JSON.stringify(paymentDetails),
    dayID // Target the correct row by DayID
  ], (err) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.sendStatus(200);
    }
  });
});

app.get('/current_day_id', (req, res) => {
  const query = `SELECT DayID FROM end_day WHERE EndTime IS NULL LIMIT 1`;

  db.query(query, (err, result) => {
    if (err) {
      res.status(500).send(err);
    } else if (result.length > 0) {
      res.json({ dayID: result[0].DayID });
    } else {
      res.status(404).json({ error: "No open day found" });
    }
  });
});


// Update shifts and payouts
app.put('/shifts-payouts/update', (req, res) => {
  const updateShiftsQuery = 'UPDATE shift_end SET Ended = 1 WHERE Ended = 0';
  const updatePayoutsQuery = 'UPDATE payouts SET IsEndOfDay = 1 WHERE ShiftEnded = 1 AND IsEndOfDay = 0';

  db.query(updateShiftsQuery, (err) => {
    if (err) {
      res.status(500).send(err);
      return;
    }

    db.query(updatePayoutsQuery, (err) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.sendStatus(200);
      }
    });
  });
});

// Login route using connection pool
app.post('/1login', (req, res) => {
  const { staffCode, password } = req.body; // Extract staffCode and password from request body

  // Ensure staffCode and password are provided
  if (!staffCode || !password) {
    console.warn('Validation failed: Missing staffCode or password');
    return res.status(400).send({ success: false, message: 'StaffCode and Password are required' });
  }

  const query = 'SELECT * FROM staff WHERE StaffCode = ? AND Password = ?';
  console.log('Executing query:', query, [staffCode, password]);

  // Use pool.query for executing the SQL query
  db.query(query, [staffCode, password], (err, results) => {
    if (err) {
      console.error('Database query error:', err.message); // Log the detailed error for debugging
      return res.status(500).send({ 
        success: false, 
        message: 'Internal server error',
        error: err.message, // Include the error message in response for debugging
      });
    }

    console.log('Query results:', results);

    // Check if any results are returned
    if (results.length > 0) {
      console.log('Login successful for staffCode:', staffCode);
      return res.status(200).send({ success: true, user: results[0] });
    } else {
      console.warn('Invalid credentials for staffCode:', staffCode);
      return res.status(401).send({ success: false, message: 'Invalid credentials' });
    }
  });
});

app.get('/1items', (req, res) => {
  const query = `
    SELECT Category, ItemCode, ItemName, Price, DepartmentID, Branch
    FROM items
    WHERE IsInactive = 0 
    ORDER BY Category, ItemName;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    console.log('Fetched Heehee Items:', results); // Debug the items fetched
    const groupedItems = results.reduce((acc, item) => {
      if (!acc[item.Category]) {
        acc[item.Category] = [];
      }
      acc[item.Category].push({
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        price: item.Price,
        departmentId: item.DepartmentID,
        branch: item.Branch, // Ensure branch is included here
      });
      return acc;
    }, {});
    res.status(200).send(groupedItems);
  });
});


app.post('/1tables', (req, res) => {
  const { name, zone_id } = req.body; // Accept `zone_id` in the request body
  const status = 'available';
  const width = 50;
  const height = 50;
  const x_position = 0;
  const y_position = 0;
  const shape = 'Square';

  const query = `
    INSERT INTO tables (name, status, zone_id, width, height, x_position, y_position, shape)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(query, [name, status, zone_id, width, height, x_position, y_position, shape], (err) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    res.status(201).send({ success: true });
  });
});

// Fetch all tables
app.get('/1tables', (req, res) => {
  const zoneId = req.query.zone_id; // Get zone_id from query parameters

  // Base query to fetch all tables
  let query = `
    SELECT id, name, status, zone_id, width, height, x_position, y_position, shape
    FROM tables
  `;

  // Add WHERE clause if zone_id is provided
  if (zoneId) {
    query += ` WHERE zone_id = ?`;
  }

  db.query(query, zoneId ? [zoneId] : [], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    res.status(200).send(results); // Keep the response structure unchanged
  });
});


// Update table name
app.put('/1tables/:id/name', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).send({ success: false, message: 'Name is required' });
  }

  const query = `UPDATE tables SET name = ? WHERE id = ?`;
  db.query(query, [name, id], (err) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    res.status(200).send({ success: true });
  });
});

app.put('/1tables/assign-zone', (req, res) => {
  const { zone_id, table_ids } = req.body;

  if (!zone_id || !table_ids || !Array.isArray(table_ids)) {
    return res.status(400).send({ success: false, message: 'Invalid input' });
  }

  const query = `UPDATE tables SET zone_id = ? WHERE id IN (?)`;
  db.query(query, [zone_id, table_ids], (err) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    res.status(200).send({ success: true });
  });
});

// Update table status route
app.put('/1tables/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).send({ success: false, message: 'Status is required' });
  }

  const query = `UPDATE tables SET status = ? WHERE id = ?`;
  db.query(query, [status, id], (err) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }

    // Broadcast the updated status to WebSocket clients
    broadcastUpdate({ id: parseInt(id, 10), status });

    res.status(200).send({ success: true });
  });
});

// Fetch all zones
app.get('/zones', (req, res) => {
  const query = `
    SELECT id, name, zone_id
    FROM zones
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }
    console.log('Zones data:', results); 
    res.status(200).send({ success: true, data: results });
  });
});

app.get('/1unpaid_orders', (req, res) => {
  const query = 'SELECT * FROM unpaid_orders';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching unpaid orders:', err);
      return res.status(500).send({ success: false, message: 'Failed to fetch unpaid orders' });
    }
    res.status(200).json({ success: true, data: results });
  });
});


// Delete unpaid order by TableName
app.delete('/1unpaid_orders/:tableName', (req, res) => {
  const tableName = req.params.tableName;

  const query = 'DELETE FROM unpaid_orders WHERE TableName = ?';
  db.query(query, [tableName], (err, result) => {
    if (err) {
      console.error('Error deleting unpaid order:', err);
      return res.status(500).json({
        success: false,
        message: `Failed to delete unpaid order for table ${tableName}`
      });
    }

    if (result.affectedRows > 0) {
      res.status(200).json({
        success: true,
        message: `Unpaid order for table ${tableName} deleted successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No unpaid order found for table ${tableName}`
      });
    }
  });
});


app.put('/1update_table_status', (req, res) => {
  const query = `
    UPDATE tables t
    JOIN unpaid_orders uo ON t.name = uo.TableName
    SET t.status = 'occupied'
    WHERE t.status != 'occupied';
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error updating table status:', err);
      return res.status(500).send({ success: false, message: 'Failed to update table status' });
    }
    res.status(200).send({ success: true, message: 'Table statuses updated', affectedRows: result.affectedRows });
  });
});

app.get('/1items/:itemCode/modifiers_addons', (req, res) => {
  const { itemCode } = req.params;

  const query = `
    SELECT m.ModifierCode, m.Modifier, m.IsSingle, ia.AddOnID, ia.AddOnName, ia.AddOnPrice
    FROM items i
    JOIN modifiers m ON i.ModifierCode = m.ModifierCode
    JOIN item_add_ons ia ON m.ModifierCode = ia.ModifierCode
    WHERE i.ItemCode = ?;
  `;

  db.query(query, [itemCode], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }

    res.status(200).send({ success: true, data: results });
  });
});

// Save order to unpaid_orders
app.post('/1unpaid_orders/saveOrUpdate', (req, res) => {
  const {
    OrderId,
    OrderDate,
    TotalPrice,
    Items,
    Discount,
    FinalPrice,
    Ordered,
    TableName,
    IsTakeAway,
  } = req.body;

  if (!OrderDate || !Items || !TableName) {
    return res.status(400).send({ success: false, message: 'Missing required fields' });
  }

  const selectQuery = `SELECT Items, TotalPrice FROM unpaid_orders WHERE TableName = ?`;

  db.query(selectQuery, [TableName], (selectErr, selectResult) => {
    if (selectErr) {
      console.error('Error fetching existing order:', selectErr);
      return res.status(500).send({ success: false, message: 'Internal server error' });
    }

    let existingItems = [];
    let newItems = [];
    let existingTotalPrice = 0;

    try {
      newItems = typeof Items === 'string' ? JSON.parse(Items) : Items;

      if (selectResult.length > 0 && selectResult[0].Items) {
        const existingItemsString = selectResult[0].Items;
        existingItems = typeof existingItemsString === 'string'
          ? JSON.parse(existingItemsString)
          : existingItemsString;
        existingTotalPrice = parseFloat(selectResult[0].TotalPrice) || 0;
      }
    } catch (e) {
      console.error('Error parsing items:', e);
      return res.status(500).send({ success: false, message: 'Error parsing items' });
    }

    // Merge the existing and new items
    const mergedItems = [...existingItems, ...newItems];
    const mergedItemsString = JSON.stringify(mergedItems);

    // Calculate the new total price by summing prices of all items
    const newTotalPrice = mergedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * (item.quantity || 1);
    }, 0);

    const finalPrice = newTotalPrice; // Update final price (if no additional logic for discount)

    // Determine whether to insert or update based on the existence of existing items
    if (selectResult.length > 0) {
      // Update existing order
      const updateQuery = `
        UPDATE unpaid_orders
        SET OrderDate = ?, TotalPrice = ?, Items = ?, Discount = ?, FinalPrice = ?, Ordered = ?, IsTakeAway = ?
        WHERE TableName = ?
      `;
      db.query(
        updateQuery,
        [
          OrderDate,
          newTotalPrice,
          mergedItemsString,
          Discount,
          finalPrice,
          Ordered,
          IsTakeAway,
          TableName,
        ],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating order:', updateErr);
            return res.status(500).send({ success: false, message: 'Error updating order' });
          }
          res.status(200).send({ success: true, message: 'Order updated successfully with merged items' });
        }
      );
    } else {
      // Insert a new order
      const insertQuery = `
        INSERT INTO unpaid_orders (OrderId, OrderDate, TotalPrice, Items, Discount, FinalPrice, Ordered, TableName, IsTakeAway)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        insertQuery,
        [
          OrderId,
          OrderDate,
          newTotalPrice,
          mergedItemsString,
          Discount,
          finalPrice,
          Ordered,
          TableName,
          IsTakeAway,
        ],
        (insertErr) => {
          if (insertErr) {
            console.error('Error inserting new order:', insertErr);
            return res.status(500).send({ success: false, message: 'Error inserting new order' });
          }
          res.status(201).send({ success: true, message: 'New order created successfully' });
        }
      );
    }
  });
});

// Fetch all printers
app.get('/1printers', (req, res) => {
  const query = `
    SELECT p.PrinterID, p.PrinterName, p.IpAddress, p.DepartmentID, d.DepartmentName, 
           p.IsOrderSlipPrinter, p.IsReceiptPrinter
    FROM printers p
    LEFT JOIN department d ON p.DepartmentID = d.DepartmentID
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching printers:', err);
      return res.status(500).send({ success: false, message: 'Error fetching printers' });
    }
    res.status(200).send({ success: true, data: results });
  });
});

// Add a new printer
app.post('/1printers', (req, res) => {
  const { IpAddress, PrinterName, DepartmentID, IsOrderSlipPrinter, IsReceiptPrinter } = req.body;

  if (!IpAddress || !PrinterName || !DepartmentID) {
    return res.status(400).send({ success: false, message: 'Missing required fields' });
  }

  const query = `
    INSERT INTO printers (IpAddress, PrinterName, DepartmentID, IsOrderSlipPrinter, IsReceiptPrinter)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(query, [IpAddress, PrinterName, DepartmentID, IsOrderSlipPrinter, IsReceiptPrinter], (err) => {
    if (err) {
      console.error('Error adding printer:', err);
      return res.status(500).send({ success: false, message: 'Error adding printer' });
    }
    res.status(201).send({ success: true, message: 'Printer added successfully' });
  });
});

// Update an existing printer
app.put('/1printers/:printerId', (req, res) => {
  const { printerId } = req.params;
  const { PrinterName, IpAddress, IsOrderSlipPrinter, IsReceiptPrinter, DepartmentID } = req.body;

  if (!PrinterName || !IpAddress) {
    return res.status(400).send({ success: false, message: 'Printer name and IP address are required' });
  }

  const query = `
    UPDATE printers
    SET PrinterName = ?, IpAddress = ?, IsOrderSlipPrinter = ?, IsReceiptPrinter = ?, DepartmentID = ?
    WHERE PrinterID = ?
  `;

  db.query(query, [PrinterName, IpAddress, IsOrderSlipPrinter, IsReceiptPrinter, DepartmentID, printerId], (err) => {
    if (err) {
      console.error('Error updating printer:', err);
      return res.status(500).send({ success: false, message: 'Error updating printer' });
    }
    res.status(200).send({ success: true, message: 'Printer updated successfully' });
  });
});


// Delete a printer by ID
app.delete('/1printers/:printerId', (req, res) => {
  const { printerId } = req.params;

  const query = `DELETE FROM printers WHERE PrinterID = ?`;

  db.query(query, [printerId], (err, result) => {
    if (err) {
      console.error('Error deleting printer:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete the printer. Please try again.',
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Printer not found or already deleted.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Printer deleted successfully',
    });
  });
});


// API to fetch all departments
app.get('/1departments', (req, res) => {
  const query = 'SELECT DepartmentID, DepartmentName FROM department';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching departments:', err);
      return res
        .status(500)
        .send({ success: false, message: 'Internal server error' });
    }
    res.status(200).send(results);
  });
});

app.put('/1updateTableName', (req, res) => {
  const { oldTableName, newTableName } = req.body;

  // Use TableName as a unique identifier to update to the new table name.
  const query = `UPDATE unpaid_orders SET TableName = ? WHERE TableName = ?`;
  db.query(query, [newTableName, oldTableName], (err, result) => {
    if (err) {
      console.error('Error updating table name:', err);
      return res.status(500).send({ success: false, message: 'Database error' });
    }

    if (result.affectedRows > 0) {
      res.send({ success: true, message: 'Table name updated successfully' });
    } else {
      res.status(404).send({ success: false, message: 'Table not found' });
    }
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const update = JSON.parse(message);
      
      if (update.action === 'table_update') {
        console.log(`Table update received: Table ${update.id} is now ${update.status}`);
        // Optionally handle table updates in the server
        broadcastUpdate(update); // Broadcast the update to all clients
      } else if (update.action === 'glass_status_update') {
        console.log(`Glass status update received: ${update.called === 1 ? 'Waiting for Pickup' : 'Picked Up'}`);
        // Optionally handle glass status updates in the server
        broadcastUpdate(update); // Broadcast the update to all clients
      } else {
        console.log('Unknown action:', update.action);
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Handle undefined routes
app.use((req, res) => {
  console.warn(`Undefined route accessed: ${req.method} ${req.url}`);
  res.status(404).send({ success: false, message: 'Endpoint not found' });
});



server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
