const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;


// Explicitly allow all methods including DELETE and PUT
app.use(cors({
    origin: '*', // In production, restrict this to your frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle Form Data from Webhooks

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://niyaoctopidigital_db_user:7K3SSLZm3MwhRwYl@odl.nlmug8f.mongodb.net/Automation_Portfolio?retryWrites=true&w=majority&appName=ODL";

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

// --- REST API Routes ---

// 0. Stats & Tracking Routes
app.post('/api/visit', async (req, res) => {
  try {
    const { visitorId, userAgent } = req.body;
    if (!visitorId) return res.status(400).json({ message: "Visitor ID required" });

    // Update existing or create new
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
    
    // Aggregation to sum up all visits
    const totalVisitsResult = await Visitor.aggregate([
      { $group: { _id: null, total: { $sum: "$visits" } } }
    ]);
    const totalVisits = totalVisitsResult.length > 0 ? totalVisitsResult[0].total : 0;
    
    // Get real booking count
    const bookingsCount = await Booking.countDocuments();

    res.json({ uniqueVisitors, totalVisits, bookingsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Internal Booking Route (Frontend)
app.post('/api/bookings', async (req, res) => {
  try {
    const { clientName, clientEmail } = req.body;
    const newBooking = await Booking.create({
        bookingId: crypto.randomUUID(),
        clientName: clientName || 'Online Visitor',
        clientEmail,
        source: 'website_widget'
    });
    res.status(201).json(newBooking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET All Bookings (Admin) - THIS IS THE ROUTE THAT WAS 404ing
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- WEBHOOK ENDPOINT FOR GOHIGHLEVEL/EXTERNAL TOOLS ---
// URL: /api/webhook/booking
app.post('/api/webhook/booking', async (req, res) => {
  try {
    console.log('Received booking webhook:', req.body);

    // Extract fields based on your GHL Custom Data configuration
    // Keys: Name, Email, Start_Date, Created
    const { Name, Email, Start_Date } = req.body;

    // Handle potential casing differences just in case
    const clientName = Name || req.body.name || 'External Client';
    const clientEmail = Email || req.body.email || '';
    const dateRaw = Start_Date || req.body.start_date;

    const newBooking = await Booking.create({
        bookingId: crypto.randomUUID(),
        clientName: clientName,
        clientEmail: clientEmail,
        appointmentDate: dateRaw ? new Date(dateRaw) : new Date(),
        status: 'confirmed',
        source: 'webhook' 
    });

    console.log(`Webhook processed. Saved booking for ${clientName}`);
    res.status(200).json({ message: 'Booking received successfully', id: newBooking.bookingId });
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
    console.log(`Attempting to delete Project with ID: ${id}`);
    const result = await Project.findOneAndDelete({ id: id });
    if (!result) {
        console.log('Project not found for deletion');
        return res.status(404).json({ message: 'Project not found' });
    }
    console.log('Project deleted successfully');
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
    console.log(`Attempting to delete Team Member with ID: ${id}`);
    const result = await TeamMember.findOneAndDelete({ id: id });
    if (!result) {
        console.log('Team member not found for deletion');
        return res.status(404).json({ message: 'Member not found' });
    }
    console.log('Team member deleted successfully');
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
    console.log(`Attempting to delete Client Image with ID: ${id}`);
    const result = await ClientImage.findOneAndDelete({ id: id });
    if (!result) {
        console.log("Client image not found");
        return res.status(404).json({ message: 'Client not found' });
    }
    console.log("Client image deleted successfully");
    res.json({ message: 'Client deleted' });
  } catch (err) {
    console.error("Delete failed:", err);
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
    console.log(`Attempting to delete Tech Tool with ID: ${id}`);
    const result = await TechTool.findOneAndDelete({ id: id });
    if (!result) return res.status(404).json({ message: 'Tool not found' });
    res.json({ message: 'Tool deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. About Us Routes (Singleton)
app.get('/api/about', async (req, res) => {
  try {
    const info = await AboutInfo.findOne();
    res.json(info || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/about', async (req, res) => {
  try {
    const { id, ...updateData } = req.body;
    const info = await AboutInfo.findOneAndUpdate(
      { id: id }, 
      req.body, 
      { new: true, upsert: true }
    );
    res.json(info);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});