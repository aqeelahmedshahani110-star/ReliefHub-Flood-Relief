// ReliefHub: Flood Relief Coordination Dashboard Server
// Node.js zero-dependency HTTP & REST API server
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const SEED_FILE = path.join(__dirname, 'db.seed.json');

// Helper to read DB synchronously
function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (fs.existsSync(SEED_FILE)) {
      const seed = fs.readFileSync(SEED_FILE, 'utf8');
      fs.writeFileSync(DB_FILE, seed, 'utf8');
      return JSON.parse(seed);
    }
    return { camps: [], inventory: [], needs: [], dispatches: [], donations: [], volunteers: [] };
  }
}

// Helper to write DB synchronously (atomic write)
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Set CORS headers
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Helper to send JSON
function sendJson(res, statusCode, payload) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body.trim()) return resolve({});
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Static file content types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = reqUrl.pathname;

  // Static File Serving
  if (!pathname.startsWith('/api/')) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, safePath);

    fs.stat(fullPath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA if not a file with extension
        if (!path.extname(fullPath)) {
          const indexPath = path.join(__dirname, 'index.html');
          fs.readFile(indexPath, (readErr, content) => {
            if (readErr) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
              res.end(content);
            }
          });
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(fullPath).pipe(res);
    });
    return;
  }

  // API Endpoints
  const segments = pathname.split('/').filter(Boolean); // ['api', 'collection', optional 'id']
  const collection = segments[1];
  const id = segments[2] ? parseInt(segments[2], 10) : null;

  // DB Reset Endpoint
  if (collection === 'reset' && req.method === 'POST') {
    try {
      if (fs.existsSync(SEED_FILE)) {
        const seedData = fs.readFileSync(SEED_FILE, 'utf8');
        fs.writeFileSync(DB_FILE, seedData, 'utf8');
        return sendJson(res, 200, { success: true, message: 'Database reset to initial seed data successfully!' });
      } else {
        return sendJson(res, 400, { error: 'Seed data file not found' });
      }
    } catch (e) {
      return sendJson(res, 500, { error: 'Failed to reset database: ' + e.message });
    }
  }

  const validCollections = ['camps', 'inventory', 'needs', 'dispatches', 'donations', 'volunteers'];
  if (!validCollections.includes(collection)) {
    return sendJson(res, 404, { error: 'Collection not found' });
  }

  const db = readDb();
  if (!db[collection]) db[collection] = [];

  try {
    // GET /api/:collection or GET /api/:collection/:id
    if (req.method === 'GET') {
      if (id !== null) {
        const item = db[collection].find(x => x.id === id);
        if (!item) return sendJson(res, 404, { error: `${collection} item with id ${id} not found` });
        return sendJson(res, 200, item);
      }
      return sendJson(res, 200, db[collection]);
    }

    // POST /api/:collection
    if (req.method === 'POST') {
      const payload = await parseBody(req);
      const items = db[collection];
      const maxId = items.reduce((max, item) => (item.id > max ? item.id : max), 0);
      const newId = maxId + 1;

      // Collection-specific logic
      if (collection === 'camps') {
        if (!payload.name || !payload.district) {
          return sendJson(res, 400, { error: 'Camp name and district are required.' });
        }
        const capacity = parseInt(payload.capacity, 10);
        let current_families = parseInt(payload.current_families || 0, 10);
        if (isNaN(capacity) || capacity <= 0) {
          return sendJson(res, 400, { error: 'Capacity must be a positive integer.' });
        }
        if (isNaN(current_families) || current_families < 0) {
          return sendJson(res, 400, { error: 'Current families must be zero or a positive integer.' });
        }
        let status = payload.status || 'Active';
        // Auto-mark Full when current families reach capacity (Milestone 1)
        if (current_families >= capacity && status !== 'Closed') {
          status = 'Full';
        }

        const newCamp = {
          id: newId,
          name: payload.name.trim(),
          district: payload.district.trim(),
          capacity,
          current_families,
          status
        };
        items.push(newCamp);
        writeDb(db);
        return sendJson(res, 201, newCamp);
      }

      if (collection === 'inventory') {
        if (!payload.name || !payload.category || !payload.unit) {
          return sendJson(res, 400, { error: 'Name, category, and unit are required.' });
        }
        const stock = parseInt(payload.stock ?? 0, 10);
        const reorder_level = parseInt(payload.reorder_level ?? 0, 10);
        if (stock < 0 || reorder_level < 0) {
          return sendJson(res, 400, { error: 'Stock and reorder level must be >= 0.' });
        }

        const newItem = {
          id: newId,
          name: payload.name.trim(),
          category: payload.category.trim(),
          unit: payload.unit.trim(),
          stock,
          reorder_level
        };
        items.push(newItem);
        writeDb(db);
        return sendJson(res, 201, newItem);
      }

      if (collection === 'needs') {
        const camp_id = parseInt(payload.camp_id, 10);
        const inventory_item_id = parseInt(payload.inventory_item_id, 10);
        const required_quantity = parseInt(payload.required_quantity, 10);
        const priority = payload.priority || 'Medium';

        if (!camp_id || !inventory_item_id || !required_quantity || required_quantity <= 0) {
          return sendJson(res, 400, { error: 'Valid camp_id, inventory_item_id, and positive required_quantity are required.' });
        }

        const camp = db.camps.find(c => c.id === camp_id);
        if (!camp) return sendJson(res, 400, { error: 'Selected camp does not exist.' });

        const inv = db.inventory.find(i => i.id === inventory_item_id);
        if (!inv) return sendJson(res, 400, { error: 'Selected inventory item does not exist.' });

        const newNeed = {
          id: newId,
          camp_id,
          inventory_item_id,
          required_quantity,
          priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
          fulfilled_quantity: parseInt(payload.fulfilled_quantity || 0, 10)
        };
        items.push(newNeed);
        writeDb(db);
        return sendJson(res, 201, newNeed);
      }

      if (collection === 'dispatches') {
        // Milestone 3:
        // - Choose a camp, a need, and a dispatch quantity
        // - Reserve stock immediately on dispatch creation
        // - Never dispatch more than available stock
        // - Never exceed a need's remaining unreserved quantity: required - fulfilled - other Pending/In Transit dispatches
        const camp_id = parseInt(payload.camp_id, 10);
        const need_id = parseInt(payload.need_id, 10);
        const quantity = parseInt(payload.quantity, 10);

        if (!camp_id || !need_id || isNaN(quantity) || quantity <= 0) {
          return sendJson(res, 400, { error: 'Valid camp_id, need_id, and quantity > 0 are required.' });
        }

        const camp = db.camps.find(c => c.id === camp_id);
        if (!camp) return sendJson(res, 400, { error: 'Camp does not exist.' });
        if (camp.status === 'Closed') {
          return sendJson(res, 400, { error: 'Cannot dispatch supplies to a Closed camp.' });
        }

        const need = db.needs.find(n => n.id === need_id && n.camp_id === camp_id);
        if (!need) return sendJson(res, 400, { error: 'Need not found for this camp.' });

        const item = db.inventory.find(i => i.id === need.inventory_item_id);
        if (!item) return sendJson(res, 400, { error: 'Inventory item linked to this need was not found.' });

        // 1. Stock availability check
        if (quantity > item.stock) {
          return sendJson(res, 400, {
            error: `Cannot dispatch ${quantity} ${item.unit}(s). Available warehouse stock is only ${item.stock} ${item.unit}(s).`
          });
        }

        // 2. Need remaining unreserved check: required - fulfilled - pending/in-transit dispatches
        const otherActiveDispatches = db.dispatches.filter(d => 
          d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
        );
        const otherReservedQty = otherActiveDispatches.reduce((acc, d) => acc + d.quantity, 0);
        const remainingUnreserved = need.required_quantity - need.fulfilled_quantity - otherReservedQty;

        if (quantity > remainingUnreserved) {
          return sendJson(res, 400, {
            error: `Cannot exceed need's remaining unreserved quantity. Remaining needed: ${Math.max(0, remainingUnreserved)} ${item.unit}(s) (Required: ${need.required_quantity}, Fulfilled: ${need.fulfilled_quantity}, Pending/In-Transit: ${otherReservedQty}).`
          });
        }

        // Reserve stock immediately
        item.stock -= quantity;

        const initialStatus = payload.status && ['Pending', 'In Transit', 'Delivered'].includes(payload.status)
          ? payload.status
          : 'Pending';

        // If created directly as Delivered (rare), update fulfilment immediately
        if (initialStatus === 'Delivered') {
          need.fulfilled_quantity += quantity;
        }

        const newDispatch = {
          id: newId,
          camp_id,
          need_id,
          quantity,
          status: initialStatus
        };
        items.push(newDispatch);
        writeDb(db);
        return sendJson(res, 201, newDispatch);
      }

      if (collection === 'donations') {
        // Milestone 4: Record Cash and In-Kind donations; in-kind contributions increase item stock.
        const type = payload.type === 'In-Kind' ? 'In-Kind' : 'Cash';
        const amount_or_quantity = parseFloat(payload.amount_or_quantity);
        if (isNaN(amount_or_quantity) || amount_or_quantity <= 0) {
          return sendJson(res, 400, { error: 'Amount or quantity must be a positive number.' });
        }

        let item_id = null;
        let category = payload.category ? payload.category.trim() : 'General';

        if (type === 'In-Kind') {
          item_id = parseInt(payload.item_id, 10);
          if (!item_id) {
            return sendJson(res, 400, { error: 'In-Kind donations must specify an inventory item.' });
          }
          const item = db.inventory.find(i => i.id === item_id);
          if (!item) {
            return sendJson(res, 400, { error: 'Selected inventory item does not exist.' });
          }
          // In-kind increases item stock immediately!
          item.stock += Math.floor(amount_or_quantity);
          category = item.category;
        }

        const newDonation = {
          id: newId,
          type,
          amount_or_quantity,
          item_id,
          category
        };
        items.push(newDonation);
        writeDb(db);
        return sendJson(res, 201, newDonation);
      }

      if (collection === 'volunteers') {
        // Milestone 4:
        // - Register volunteers and search/filter by Medical, Logistics, Cooking, Driving or Counselling skills.
        // - Assign/unassign volunteers to camps; each volunteer may have only one assignment and cannot be assigned to a Closed camp.
        if (!payload.name || !payload.skill) {
          return sendJson(res, 400, { error: 'Volunteer name and skill are required.' });
        }
        const validSkills = ['Medical', 'Logistics', 'Cooking', 'Driving', 'Counselling'];
        if (!validSkills.includes(payload.skill)) {
          return sendJson(res, 400, { error: 'Skill must be one of: Medical, Logistics, Cooking, Driving, Counselling.' });
        }

        let camp_id = payload.camp_id ? parseInt(payload.camp_id, 10) : null;
        if (camp_id) {
          const camp = db.camps.find(c => c.id === camp_id);
          if (!camp) return sendJson(res, 400, { error: 'Assigned camp does not exist.' });
          if (camp.status === 'Closed') {
            return sendJson(res, 400, { error: 'Cannot assign a volunteer to a Closed camp.' });
          }
        }

        const newVol = {
          id: newId,
          name: payload.name.trim(),
          skill: payload.skill,
          camp_id
        };
        items.push(newVol);
        writeDb(db);
        return sendJson(res, 201, newVol);
      }

      // Generic fallback
      const genericItem = { id: newId, ...payload };
      items.push(genericItem);
      writeDb(db);
      return sendJson(res, 201, genericItem);
    }

    // PUT /api/:collection/:id
    if (req.method === 'PUT') {
      if (id === null) return sendJson(res, 400, { error: 'ID required in URL for PUT.' });
      const items = db[collection];
      const index = items.findIndex(x => x.id === id);
      if (index === -1) return sendJson(res, 404, { error: `Item with id ${id} not found.` });

      const existing = items[index];
      const payload = await parseBody(req);

      if (collection === 'camps') {
        const capacity = payload.capacity !== undefined ? parseInt(payload.capacity, 10) : existing.capacity;
        let current_families = payload.current_families !== undefined ? parseInt(payload.current_families, 10) : existing.current_families;
        let status = payload.status !== undefined ? payload.status : existing.status;

        if (isNaN(capacity) || capacity <= 0) {
          return sendJson(res, 400, { error: 'Capacity must be positive.' });
        }
        if (isNaN(current_families) || current_families < 0) {
          return sendJson(res, 400, { error: 'Current families must be >= 0.' });
        }

        // Auto mark Full when current families reach capacity
        if (current_families >= capacity && status !== 'Closed') {
          status = 'Full';
        } else if (status === 'Full' && current_families < capacity) {
          status = 'Active';
        }

        // If camp is being closed, check and unassign volunteers
        if (status === 'Closed' && existing.status !== 'Closed') {
          db.volunteers.forEach(v => {
            if (v.camp_id === id) v.camp_id = null;
          });
        }

        existing.name = payload.name !== undefined ? payload.name.trim() : existing.name;
        existing.district = payload.district !== undefined ? payload.district.trim() : existing.district;
        existing.capacity = capacity;
        existing.current_families = current_families;
        existing.status = status;

        writeDb(db);
        return sendJson(res, 200, existing);
      }

      if (collection === 'inventory') {
        if (payload.stock !== undefined && payload.stock < 0) {
          return sendJson(res, 400, { error: 'Stock cannot be negative.' });
        }
        if (payload.reorder_level !== undefined && payload.reorder_level < 0) {
          return sendJson(res, 400, { error: 'Reorder level cannot be negative.' });
        }

        existing.name = payload.name !== undefined ? payload.name.trim() : existing.name;
        existing.category = payload.category !== undefined ? payload.category.trim() : existing.category;
        existing.unit = payload.unit !== undefined ? payload.unit.trim() : existing.unit;
        if (payload.stock !== undefined) existing.stock = parseInt(payload.stock, 10);
        if (payload.reorder_level !== undefined) existing.reorder_level = parseInt(payload.reorder_level, 10);

        writeDb(db);
        return sendJson(res, 200, existing);
      }

      if (collection === 'needs') {
        if (payload.required_quantity !== undefined && payload.required_quantity <= 0) {
          return sendJson(res, 400, { error: 'Required quantity must be > 0.' });
        }
        if (payload.fulfilled_quantity !== undefined && payload.fulfilled_quantity < 0) {
          return sendJson(res, 400, { error: 'Fulfilled quantity cannot be negative.' });
        }
        if (payload.priority && !['High', 'Medium', 'Low'].includes(payload.priority)) {
          return sendJson(res, 400, { error: 'Priority must be High, Medium, or Low.' });
        }

        existing.required_quantity = payload.required_quantity !== undefined ? parseInt(payload.required_quantity, 10) : existing.required_quantity;
        existing.fulfilled_quantity = payload.fulfilled_quantity !== undefined ? parseInt(payload.fulfilled_quantity, 10) : existing.fulfilled_quantity;
        if (payload.priority) existing.priority = payload.priority;

        writeDb(db);
        return sendJson(res, 200, existing);
      }

      if (collection === 'dispatches') {
        // Milestone 3 rules:
        // Support Pending, In Transit, Delivered and Cancelled states.
        // Delivered dispatches increase fulfilment; cancelling an undelivered dispatch restores stock.
        const newStatus = payload.status;
        const oldStatus = existing.status;

        if (!['Pending', 'In Transit', 'Delivered', 'Cancelled'].includes(newStatus)) {
          return sendJson(res, 400, { error: 'Invalid dispatch status.' });
        }

        const need = db.needs.find(n => n.id === existing.need_id);
        const item = need ? db.inventory.find(i => i.id === need.inventory_item_id) : null;

        if (oldStatus !== newStatus) {
          if (newStatus === 'Delivered') {
            if (oldStatus === 'Cancelled') {
              return sendJson(res, 400, { error: 'Cannot deliver a cancelled dispatch.' });
            }
            if (oldStatus === 'Pending' || oldStatus === 'In Transit') {
              if (need) {
                need.fulfilled_quantity += existing.quantity;
              }
            }
          } else if (newStatus === 'Cancelled') {
            if (oldStatus === 'Delivered') {
              return sendJson(res, 400, { error: 'Cannot cancel an already delivered dispatch.' });
            }
            if (oldStatus === 'Pending' || oldStatus === 'In Transit') {
              // Restore stock back to warehouse inventory
              if (item) {
                item.stock += existing.quantity;
              }
            }
          }
        }

        existing.status = newStatus;
        writeDb(db);
        return sendJson(res, 200, existing);
      }

      if (collection === 'volunteers') {
        if (payload.camp_id !== undefined) {
          const targetCampId = payload.camp_id ? parseInt(payload.camp_id, 10) : null;
          if (targetCampId) {
            const camp = db.camps.find(c => c.id === targetCampId);
            if (!camp) return sendJson(res, 400, { error: 'Camp does not exist.' });
            if (camp.status === 'Closed') {
              return sendJson(res, 400, { error: 'Cannot assign volunteer to a Closed camp.' });
            }
          }
          existing.camp_id = targetCampId;
        }

        if (payload.name) existing.name = payload.name.trim();
        if (payload.skill) {
          const validSkills = ['Medical', 'Logistics', 'Cooking', 'Driving', 'Counselling'];
          if (!validSkills.includes(payload.skill)) {
            return sendJson(res, 400, { error: 'Invalid skill.' });
          }
          existing.skill = payload.skill;
        }

        writeDb(db);
        return sendJson(res, 200, existing);
      }

      // Generic update
      Object.assign(existing, payload);
      existing.id = id;
      writeDb(db);
      return sendJson(res, 200, existing);
    }

    // DELETE /api/:collection/:id
    if (req.method === 'DELETE') {
      if (id === null) return sendJson(res, 400, { error: 'ID required in URL for DELETE.' });
      const items = db[collection];
      const index = items.findIndex(x => x.id === id);
      if (index === -1) return sendJson(res, 404, { error: `Item with id ${id} not found.` });

      const item = items[index];

      // If dispatch is deleted while Pending or In Transit, restore stock!
      if (collection === 'dispatches') {
        if (item.status === 'Pending' || item.status === 'In Transit') {
          const need = db.needs.find(n => n.id === item.need_id);
          const invItem = need ? db.inventory.find(i => i.id === need.inventory_item_id) : null;
          if (invItem) {
            invItem.stock += item.quantity;
          }
        }
      }

      // If camp is deleted, unassign volunteers & remove camp needs/dispatches
      if (collection === 'camps') {
        db.volunteers.forEach(v => {
          if (v.camp_id === id) v.camp_id = null;
        });
        db.needs = db.needs.filter(n => n.camp_id !== id);
        db.dispatches = db.dispatches.filter(d => d.camp_id !== id);
      }

      items.splice(index, 1);
      writeDb(db);
      return sendJson(res, 200, { success: true, message: `Deleted ${collection} #${id}`, deletedItem: item });
    }

    return sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log(`ReliefHub server running at http://localhost:${PORT}/`);
});
