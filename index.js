const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const serviceAccount = require("./firebase-service-account.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rxq0qzb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });


function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized: No token" });
  }
  const idToken = authHeader.split(" ")[1];
  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decoded) => {
      req.user = decoded;
      next();
    })
    .catch(() => {
      res.status(403).send({ error: "Forbidden: Invalid token" });
    });
}

async function run() {
  try {
    await client.connect();
    const db = client.db("newspaperDB");

    const userCol = db.collection("users");
    const articleCol = db.collection("articles");
    const publisherCol = db.collection("publishers");
    const publisherRequestCol = db.collection("publisherRequests");
    
    




    
    app.put("/users/:email", verifyFirebaseToken, async (req, res) => {
      const result = await userCol.updateOne(
        { email: req.params.email },
        { $set: { ...req.body, updatedAt: new Date() } },
        { upsert: true }
      );
      res.send(result);
    });

  
    app.get("/users/:email", async (req, res) => {
      try {
        const user = await userCol.findOne({ email: req.params.email });
        if (!user) return res.status(404).send({ error: "User not found" });
        res.send(user);
      } catch (error) {
        res.status(500).send({ error: "Server error" });
      }
    });

   
    app.get("/users", async (req, res) => {
      const users = await userCol.find().toArray();
      res.send(users);
    });

   
    app.patch("/users/admin/:email", async (req, res) => {
      const result = await userCol.updateOne(
        { email: req.params.email },
        { $addToSet: { roles: "admin" } }
      );
      res.send(result);
    });

  

   
    app.post("/articles", verifyFirebaseToken, async (req, res) => {
      const email = req.user.email;
      const user = await userCol.findOne({ email });
      const alreadyPosted = await articleCol.findOne({ authorEmail: email });

      if (!user?.premiumTaken && alreadyPosted) {
        return res.status(403).send({ error: "Normal user can post only 1 article." });
      }

      const result = await articleCol.insertOne({
        ...req.body,
        authorEmail: email,
        status: "pending",
        isPremium: req.body.isPremium === true,
        viewCount: 0,
        postedAt: new Date(),
      });
      res.send(result);
    });

   
    app.get("/articles", async (req, res) => {
      const { publisher, tag, search, sort, limit } = req.query;
      const filter = { status: "approved" };
      if (publisher) filter.publisher = publisher;
      if (tag) filter.tags = tag;
      if (search) filter.title = { $regex: search, $options: "i" };
      const sortOpt = sort ? { [sort]: -1 } : { postedAt: -1 };
      const max = parseInt(limit) || 0;

      const articles = await articleCol.find(filter).sort(sortOpt).limit(max).toArray();
      res.send(articles);
    });

    
    app.get("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const article = await articleCol.findOne({ _id: new ObjectId(id) });
      if (article) {
        await articleCol.updateOne({ _id: new ObjectId(id) }, { $inc: { viewCount: 1 } });
      }
      res.send(article);
    });

    
    app.get("/trending", async (req, res) => {
      const trending = await articleCol
        .find({ status: "approved" })
        .sort({ viewCount: -1 })
        .limit(6)
        .toArray();
      res.send(trending);
    });

    
    app.get("/my-articles/:email", verifyFirebaseToken, async (req, res) => {
      const result = await articleCol.find({ authorEmail: req.params.email }).toArray();
      res.send(result);
    });

   
    app.delete("/articles/:id", verifyFirebaseToken, async (req, res) => {
      const result = await articleCol.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });








app.get("/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 2;
    const articles = await articleCol
      .find({ status: "approved" })
      .sort({ postedAt: -1 })
      .limit(limit)
      .toArray();
    res.send(articles);
  } catch (error) {
    console.error("Error fetching latest articles:", error);
    res.status(500).send({ error: "Failed to fetch latest articles" });
  }
});


app.get("/stats", async (req, res) => {
  try {
    const users = await userCol.find().toArray();
    const normal = users.filter((u) => !u.premiumTaken).length;
    const premium = users.filter((u) => u.premiumTaken).length;
    
    const publisherCount = await publisherCol.countDocuments();
    const articleCount = await articleCol.countDocuments({ status: "approved" });
    const pendingArticles = await articleCol.countDocuments({ status: "pending" });
    
    res.send({ 
      total: users.length, 
      normal, 
      premium,
      publishers: publisherCount,
      articles: articleCount,
      pendingArticles
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).send({ error: "Failed to fetch stats" });
  }
});

























    
    

    
    app.put("/articles/:id", verifyFirebaseToken, async (req, res) => {
      const data = req.body;
      delete data._id;
      const result = await articleCol.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: data }
      );
      res.send(result);
    });

    

    app.get("/admin/articles", async (req, res) => {
      const result = await articleCol.find().toArray();
      res.send(result);
    });

    app.patch("/admin/articles/approve/:id", async (req, res) => {
      const result = await articleCol.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "approved" } }
      );
      res.send(result);
    });

    app.patch("/admin/articles/decline/:id", async (req, res) => {
      const { reason } = req.body;
      const result = await articleCol.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "declined", declineReason: reason } }
      );
      res.send(result);
    });

    app.patch("/admin/articles/premium/:id", async (req, res) => {
      const result = await articleCol.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isPremium: true } }
      );
      res.send(result);
    });

    app.delete("/admin/articles/:id", async (req, res) => {
      const result = await articleCol.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

 

    app.post("/publishers", async (req, res) => {
      const { name, email, logo } = req.body;
      const exists = await publisherCol.findOne({ email });
      if (exists) {
        return res.status(409).send({ error: "This person is already a publisher" });
      }
      const result = await publisherCol.insertOne({ name, email, logo, createdAt: new Date() });
      res.send(result);
    });

    app.get("/publishers", async (req, res) => {
      const publishers = await publisherCol.find().toArray();
      const enriched = await Promise.all(
        publishers.map(async (p) => {
          const count = await articleCol.countDocuments({ publisher: p.name, status: "approved" });
          return { ...p, articleCount: count };
        })
      );
      res.send(enriched);
    });





    

    app.delete("/admin/publishers/:id", async (req, res) => {
      const result = await publisherCol.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.get("/publishers/check-email/:email", async (req, res) => {
      const exists = await publisherCol.findOne({ email: req.params.email });
      res.send({ exists: !!exists });
    });






// check request

app.get("/publisher-request/check", verifyFirebaseToken, async (req, res) => {
  const email = req.user.email;
  const user = await userCol.findOne({ email });
  const request = await publisherRequestCol.findOne({ email });
  const publisher = await publisherCol.findOne({ email });

  const isPublisher = user?.roles?.includes("publisher") && !!publisher;

  res.send({ exists: !!request, status: request?.status || null, isPublisher });
});











    // publisher request

    app.post("/publisher-request", verifyFirebaseToken, async (req, res) => {
      const email = req.user.email;
      const { name, logo, reason } = req.body;

      const alreadyPublisher = await publisherCol.findOne({ email });
      if (alreadyPublisher) return res.status(409).send({ error: "Already a publisher" });

      const exists = await publisherRequestCol.findOne({ email, status: "pending" });
      if (exists) return res.status(409).send({ error: "Already requested" });

      const result = await publisherRequestCol.insertOne({
        email,
        name,
        logo,
        reason,
        status: "pending",
        requestedAt: new Date(),
      });
      res.send(result);
    });

    app.get("/publisher-request/check", verifyFirebaseToken, async (req, res) => {
      const email = req.user.email;
      const user = await userCol.findOne({ email });
      const request = await publisherRequestCol.findOne({ email });
      const publisher = await publisherCol.findOne({ email });

      const isPublisher = user?.roles?.includes("publisher") && !!publisher;

      res.send({ exists: !!request, status: request?.status || null, isPublisher });
    });

    app.get("/admin/publisher-requests", async (req, res) => {
      const result = await publisherRequestCol.find().toArray();
      res.send(result);
    });
// approve
    app.patch("/admin/publisher-requests/approve/:id", async (req, res) => {
      const id = req.params.id;
      const request = await publisherRequestCol.findOne({ _id: new ObjectId(id) });
      if (!request) return res.status(404).send({ error: "Request not found" });

      await userCol.updateOne({ email: request.email }, { $addToSet: { roles: "publisher" } });

      const exists = await publisherCol.findOne({ email: request.email });
      if (!exists) {
        await publisherCol.insertOne({
          name: request.name,
          logo: request.logo,
          email: request.email,
          createdAt: new Date(),
        });
      }

      await publisherRequestCol.deleteOne({ _id: new ObjectId(id) });
      res.send({ success: true });
    });
//decline
    app.patch("/admin/publisher-requests/decline/:id", async (req, res) => {
      const result = await publisherRequestCol.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

   
//count pending
    app.get("/admin/article-requests/count-pending", async (req, res) => {
      try {
        const count = await articleCol.countDocuments({ status: "pending" });
        res.send({ count });
      } catch (error) {
        console.error("Error fetching pending article requests count", error);
        res.status(500).send({ error: "Failed to get count" });
      }
    });

    app.get("/admin/publisher-requests/count-pending", async (req, res) => {
      try {
        const count = await publisherRequestCol.countDocuments({ status: "pending" });
        res.send({ count });
      } catch (error) {
        console.error("Error fetching pending publisher requests count", error);
        res.status(500).send({ error: "Failed to get count" });
      }
    });

   

    app.post("/subscribe/:email", verifyFirebaseToken, async (req, res) => {
      try {
        const { duration } = req.body;
        const email = req.params.email;

        if (!duration || typeof duration !== "number" || duration <= 0) {
          return res.status(400).send({ error: "Invalid duration" });
        }

        const user = await userCol.findOne({ email });
        if (!user) {
          return res.status(404).send({ error: "User not found" });
        }

        const premiumUntil = new Date(Date.now() + duration * 60000);

        const result = await userCol.updateOne(
          { email },
          { $set: { premiumTaken: premiumUntil } }
        );

        if (result.modifiedCount === 0) {
          return res.status(500).send({ error: "Subscription update failed" });
        }

        
        const updatedUser = await userCol.findOne({ email });
        res.send({
          success: true,
          user: updatedUser,
          premiumUntil,
        });
      } catch (err) {
        console.error("Subscription Error:", err);
        res.status(500).send({ error: "Subscription failed" });
      }
    });

    app.get("/premium-articles", verifyFirebaseToken, async (req, res) => {
      const result = await articleCol.find({ isPremium: true, status: "approved" }).toArray();
      res.send(result);
    });

  

    app.get("/stats", async (req, res) => {
      const users = await userCol.find().toArray();
      const normal = users.filter((u) => !u.premiumTaken).length;
      const premium = users.filter((u) => u.premiumTaken).length;
      res.send({ total: users.length, normal, premium });
    });

    console.log("MongoDB Connected");
  } catch (err) {
    console.error("Error in run()", err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Newspaper Project Server Running");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});