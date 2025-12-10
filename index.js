const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// The webhook URL to trigger in GoHighLevel when a booking is updated in the dashboard
const GHL_TRIGGER_URL = "https://services.leadconnectorhq.com/hooks/FFZVCsG7Awyv1RFevnwQ/webhook-trigger/1d7d75ed-befd-4a86-a709-700609c7843d";

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || "";
mongodb+srv://ai_automation:pMWHlI1RKIwCmrPH@cluster0.w5am0gy.mongodb.net/Automation_Portfolio?retryWrites=true&w=majority&appName=cluster0
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Import Models
const Project = require('./models/Project');
const TeamMember = require('./models/TeamMember');
const Workflow = require('./models/Workflow');
const ClientImage = require('./models/ClientImage');
const TechTool = require('./models/TechTool');
const AboutInfo = require('./models/AboutInfo');
const Visitor = require('./models/Visitor');
const Booking = require('./models/Booking');
const ChatWidget = require('./models/ChatWidget'); // New Chat Model

// --- REST API Routes ---

// AUTH ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { password } = req.body;
        // Fetch the single AboutInfo document where password is stored
        let info = await AboutInfo.findOne();
        
        // If no info exists yet, create default with default password
        if (!info) {
            info = await AboutInfo.create({
                id: 'default',
                agencyName: 'AgencyAI',
                adminPassword: 'admin123',
                bio: 'Welcome to your new agency site.',
                totalProjects: '0',
                hoursLogged: '0'
            });
        }

        if (info.adminPassword === password) {
            res.json({ success: true, message: 'Authenticated' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Password' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 0. Stats & Tracking Routes
app.post('/api/visit', async (req, res) => {
  try {
    const { visitorId, userAgent } = req.body;
    if (!visitorId) return res.status(400).json({ message: "Visitor ID required" });

    const visitor = await Visitor.findOneAndUpdate(
      { visitorId },
      { 
        $set: { userAgent, lastVisit: new Date() },
        $inc: { visits: 1 } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(visitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const uniqueVisitors = await Visitor.countDocuments();
    const totalVisitsResult = await Visitor.aggregate([
      { $group: { _id: null, total: { $sum: "$visits" } } }
    ]);
    const totalVisits = totalVisitsResult.length > 0 ? totalVisitsResult[0].total : 0;
    const bookingsCount = await Booking.countDocuments();

    res.json({ uniqueVisitors, totalVisits, bookingsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Internal Booking Route (Frontend Widget)
app.post('/api/bookings', async (req, res) => {
  try {
    const { clientName, clientEmail, appointmentDate } = req.body;
    const newBooking = await Booking.create({
        bookingId: crypto.randomUUID(),
        clientName: clientName || 'Online Visitor',
        clientEmail,
        appointmentDate: appointmentDate || new Date().toISOString(),
        source: 'website_widget',
        status: 'new'
    });
    res.status(201).json(newBooking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET All Bookings (Admin)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// GET All Chats (Admin)
app.get('/api/chats', async (req, res) => {
  try {
    // Sort by updated at desc
    const chats = await ChatWidget.find().sort({ updatedAt: -1 }).limit(100);
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE Booking (Admin) - Supports full edit and Triggers External Webhook
app.put('/api/bookings/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: req.body },
      { new: true }
    );
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // --- TRIGGER EXTERNAL GHL WEBHOOK ---
    try {
        console.log(`Triggering external GHL webhook for booking ${booking.bookingId} with status: ${booking.status}`);
        
        const payload = {
            email: booking.clientEmail || '',
            status: booking.status || 'new', 
            name: booking.clientName,
            firstName: booking.clientName.split(' ')[0] || '',
            lastName: booking.clientName.split(' ').slice(1).join(' ') || '',
            phone: '',
            appointmentDate: booking.appointmentDate,
            externalId: booking.externalId,
            bookingId: booking.bookingId,
            source: 'admin_dashboard',
            lastUpdated: new Date().toISOString()
        };

        fetch(GHL_TRIGGER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(async response => {
            if (response.ok) {
                console.log('Successfully triggered GHL webhook');
            } else {
                const txt = await response.text();
                console.error('GHL Webhook returned error:', response.status, txt);
            }
        })
        .catch(err => console.error('Failed to call GHL webhook:', err.message));

    } catch (webhookErr) {
        console.error('Error constructing webhook payload:', webhookErr);
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- WEBHOOK ENDPOINT FOR INBOUND GOHIGHLEVEL DATA ---
app.post('/api/webhook/booking', async (req, res) => {
  try {
    console.log('Received booking webhook:', JSON.stringify(req.body, null, 2));

    const body = req.body || {};

    let externalId = null;
    if (body.calendar && body.calendar.appointmentId) externalId = body.calendar.appointmentId;
    else if (body.appointmentId) externalId = body.appointmentId;
    else if (body.id) externalId = body.id;

    let clientName = 'External Client';
    if (body.full_name) clientName = body.full_name;
    else if (body.first_name && body.last_name) clientName = `${body.first_name} ${body.last_name}`;
    else if (body.Name) clientName = body.Name;
    else if (body.name) clientName = body.name;
    else if (body.contact_name) clientName = body.contact_name;
    else if (body.firstName && body.lastName) clientName = `${body.firstName} ${body.lastName}`;

    let dateRaw = null;
    if (body.calendar && body.calendar.startTime) {
        dateRaw = body.calendar.startTime;
    } else {
        dateRaw = 
            body.Start_Date || 
            body.start_date || 
            body.appointment_date || 
            body.appointment_start_date || 
            body.appointment_start_time || 
            body.calendar_startTime || 
            body.start_time ||
            body.startTime;
    }
    if (!dateRaw) dateRaw = new Date().toISOString();

    const clientEmail = body.Email || body.email || body.contact_email || '';

    let rawStatus = null;
    if (body.calendar) {
        if (body.calendar.appoinmentStatus) rawStatus = body.calendar.appoinmentStatus; 
        else if (body.calendar.appointmentStatus) rawStatus = body.calendar.appointmentStatus; 
        else if (body.calendar.status) rawStatus = body.calendar.status; 
    }

    if (!rawStatus) {
        if (body.appoinmentStatus) rawStatus = body.appoinmentStatus; 
        else if (body.appointmentStatus) rawStatus = body.appointmentStatus; 
        else if (body.status) rawStatus = body.status; 
    }

    if (!rawStatus) rawStatus = 'new';

    let status = rawStatus;
    const lowerStatus = String(rawStatus).toLowerCase();
    
    if (lowerStatus === 'booked') status = 'confirmed';
    else if (lowerStatus === 'confirmed') status = 'confirmed';
    else if (lowerStatus === 'showed') status = 'Showed';
    else if (lowerStatus === 'no-show' || lowerStatus === 'noshow') status = 'No-show';
    else if (lowerStatus === 'cancelled' || lowerStatus === 'canceled') status = 'cancelled';
    else if (lowerStatus === 'invalid') status = 'invalid';
    else if (lowerStatus === 'new') status = 'new';

    const source = body.contact_source || 'webhook';

    let booking;
    
    if (externalId) {
        booking = await Booking.findOne({ externalId: externalId });
    }

    if (!booking && clientEmail) {
        booking = await Booking.findOne({ clientEmail: clientEmail }).sort({ createdAt: -1 });
    }

    if (booking) {
        booking.clientName = clientName;
        booking.appointmentDate = String(dateRaw);
        booking.status = status;
        booking.source = source;
        if (externalId) booking.externalId = externalId; 
        await booking.save();
    } else {
        booking = await Booking.create({
            bookingId: crypto.randomUUID(),
            clientName: clientName,
            clientEmail: clientEmail,
            appointmentDate: String(dateRaw), 
            status: status, 
            source: source,
            externalId: externalId 
        });
    }

    res.status(200).json({ message: 'Booking processed successfully', id: booking.bookingId });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ message: 'Error processing webhook', error: err.message });
  }
});

// 1. Projects Routes
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ order: 1, createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const project = new Project(req.body);
  try {
    const newProject = await project.save();
    res.status(201).json(newProject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/projects/reorder', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates || !Array.isArray(updates)) return res.status(400).json({ message: "Invalid updates" });

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { id: update.id },
        update: { $set: { order: update.order } }
      }
    }));

    await Project.bulkWrite(bulkOps);
    res.json({ message: "Projects reordered" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    const result = await Project.findOneAndDelete({ id: id });
    if (!result) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Team Routes
app.get('/api/team', async (req, res) => {
  try {
    const team = await TeamMember.find().sort({ createdAt: 1 });
    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/team', async (req, res) => {
  const member = new TeamMember(req.body);
  try {
    const newMember = await member.save();
    res.status(201).json(newMember);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/team/:id', async (req, res) => {
  try {
    const member = await TeamMember.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/team/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    const result = await TeamMember.findOneAndDelete({ id: id });
    if (!result) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Workflow Routes
app.get('/api/workflows', async (req, res) => {
  try {
    const workflows = await Workflow.find().sort({ createdAt: -1 });
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  const workflow = new Workflow(req.body);
  try {
    const newWorkflow = await workflow.save();
    res.status(201).json(newWorkflow);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/workflows/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/workflows/:id', async (req, res) => {
  try {
    const result = await Workflow.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ message: 'Workflow not found' });
    res.json({ message: 'Workflow deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Client Images Routes
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await ClientImage.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/clients', async (req, res) => {
  const client = new ClientImage(req.body);
  try {
    const newClient = await client.save();
    res.status(201).json(newClient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    const result = await ClientImage.findOneAndDelete({ id: id });
    if (!result) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Tech Stack Routes
app.get('/api/tech-stack', async (req, res) => {
  try {
    const tools = await TechTool.find().sort({ category: 1, name: 1 });
    res.json(tools);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/tech-stack', async (req, res) => {
  const tool = new TechTool(req.body);
  try {
    const newTool = await tool.save();
    res.status(201).json(newTool);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/tech-stack/:id', async (req, res) => {
  try {
    const tool = await TechTool.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    res.json(tool);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/tech-stack/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    const result = await TechTool.findOneAndDelete({ id: id });
    if (!result) return res.status(404).json({ message: 'Tool not found' });
    res.json({ message: 'Tool deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. About Us Routes
app.get('/api/about', async (req, res) => {
  try {
    // Return all info including agencyName and adminPassword so they can be edited in the dashboard
    let info = await AboutInfo.findOne();
    if (!info) {
       info = await AboutInfo.create({
            id: 'default',
            agencyName: 'AgencyAI',
            adminPassword: 'admin123',
            bio: 'Welcome.',
            totalProjects: '0',
            hoursLogged: '0'
       });
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/about', async (req, res) => {
  try {
    const { id, ...updateData } = req.body;
    const info = await AboutInfo.findOneAndUpdate(
      { id: id || 'default' }, 
      req.body, 
      { new: true, upsert: true }
    );
    res.json(info);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});