/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
require("dotenv").config();
var express = require("express");
var bodyParser = require("body-parser");
var mysql = require("mysql2");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const http = require('http');
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const session = require("express-session");
const AWS = require('aws-sdk');
const cors = require("cors");

const app = express();
const PORT = 6069;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/images/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fieldSize: 1024 * 1024 * 3,
  },
});

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "L1v)28L2ovSw",
  database: "rareminds",
});

con.connect(function (err) {
  if (err) throw err;
});

const mysqlQuery = async (connection, queryConfig) => {
  // console.log("query config", queryConfig);
  const config = { ...queryConfig, timeout: 4000 };

  return new Promise((resolve, reject) => {
    return connection.query(config, function (error, results, fields) {
      if (error) {
        reject(error);
      }
      resolve(results);
    });
  });
};

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function convertToSlug(Text) {
  return Text.toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
}

//Allow all requests from all domains & localhost
app.all("/*", function (req, res, next) {
  console.log("call api");
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "POST, GET");
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/uploads", express.static("public/images/uploads/"));

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    "1e43ec24f7ddefb1a824fe6dba87cfb8e387924d8126262bc38b2978c06dddb7",
    { expiresIn: "7d" }
  );
};

const checkRecordExists = async (tableName, column, value) => {
  let result = await mysqlQuery(con, {
    sql: `SELECT * FROM ${tableName} WHERE ${column} = "${value}"`,
  });
  if (result) {
    return result[0];
  } else {
    return false;
  }
};

app.post("/login", async function (req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    res
      .status(400)
      .json({ error: "Email or Password fields cannot be empty!" });
    return;
  }

  try {
    const existingUser = await checkRecordExists(
      "rm_admin_users",
      "AdminLoginId",
      email
    );

    if (existingUser) {
      if (!existingUser.AdminLoginPassword) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const passwordMatch = await bcrypt.compare(
        password,
        existingUser.AdminLoginPassword
      );

      if (passwordMatch) {
        res.status(200).json({
          userId: existingUser.AdminUserId,
          email: existingUser.AdminLoginId,
          access_token: generateAccessToken(existingUser.AdminUserId),
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/pages", function (req, res) {
  con.query("SELECT * FROM rm_pages", function (err, result, fields) {
    if (err) throw err;
    res.send(result);
  });
});

app.get("/dashboard", async function (req, res) {
  let blogsData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 41 order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });
  
  let generalEventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 51 order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  let subscribers = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_subscribers",
  });

  let queries = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_queries",
  });

  let galleryData = await mysqlQuery(con, {
    sql: "SELECT * FROM gallery",
  });

  res.send({
    blogsData,
    generalEventData,
    subscribers,
    queries,
    galleryData,
  });
});




// Insert intern data into MySQL
app.post('/insertInterns', (req, res) => {
  const interns = req.body.interns; // Expecting data to be sent in the body as { interns: [...] }

  interns.forEach((intern) => {
    const { fullName, company, skill, university, districtCollegeName } = intern;

    const query = `
      INSERT INTO interns (fullName, company, skill, university, districtCollegeName)
      VALUES (?, ?, ?, ?, ?)
    `;

    con.query(query, [fullName, company, skill, university, districtCollegeName], (err, result) => {
      if (err) {
        console.error('Error inserting intern:', err);
        return res.status(500).send('Error inserting intern data');
      }
      console.log(`Intern ${fullName} inserted successfully.`);
    });
  });

  res.send('Intern data inserted successfully');
});

// Insert company data into MySQL
app.post('/insertCompanies', (req, res) => {
  const companies = req.body.companies;

  companies.forEach((company) => {
    const { clientName, industry, location, logo, jobs } = company;

    const query = `
      INSERT INTO companies (clientName, industry, location, logo, jobs)
      VALUES (?, ?, ?, ?, ?)
    `;

    con.query(query, [clientName, industry, location, logo, JSON.stringify(jobs)], (err, result) => {
      if (err) {
        console.error('Error inserting company:', err);
        return res.status(500).send('Error inserting company data');
      }
      console.log(`Company ${clientName} inserted successfully.`);
    });
  });

  res.send('Company data inserted successfully');
});


app.get('/getInterns', (req, res) => {
  const query = 'SELECT * FROM interns';
  
  con.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching interns:', err);
      return res.status(500).send('Error fetching interns');
    }
    console.log(results)
    res.json(results); // Send the data as JSON to the frontend
  });
});


app.get('/getCompanies', (req, res) => {
  const query = 'SELECT * FROM companies';
  
  con.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching companies:', err);
      return res.status(500).send('Error fetching companies');
    }
    res.json(results); // Send the data as JSON to the frontend
  });
});




app.get("/pages/:pageSlug", async function (req, res) {
  const pageSlug = req.params.pageSlug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  let sectionData = [];

  if (pageSlug === "privacy-policy") {
    sectionData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentTypeId = 45",
    });
  } else if (pageSlug === "terms-&-conditions") {
    sectionData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentTypeId = 46",
    });
  } else if (pageSlug === "about-us") {
    sectionData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentTypeId = 43",
    });
  } else {
    sectionData = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content WHERE PageId = " +
        pageData[0].PageId +
        " AND ContentTypeId != 38 order by UNIX_TIMESTAMP(CreatedOn) DESC",
    });
    sectionData.map(async (ele) => {
      let contentData = await mysqlQuery(con, {
        sql:
          "SELECT ContentSlug from rm_content_types WHERE ContentTypeId = " +
          ele.ContentTypeId,
      });
      if (ele.ContentTypeId === 40 || ele.ContentTypeId === 41) {
        ele.PageSlug = ele.ContentSlug;
      }
      ele.ContentSlug = contentData[0].ContentSlug;
    });
  }

  let serviceData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 38",
  });

  let blogsData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 41 order by UNIX_TIMESTAMP(CreatedOn) DESC LIMIT 6 ",
  });

  let generalEventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 51 order by UNIX_TIMESTAMP(CreatedOn) DESC LIMIT 6 ",
  });

  let achievementsData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 7",
  });

  let studyData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE ContentTypeId = 40 AND PageId = " +
      pageData[0].PageId +
      " order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  if (achievementsData.length > 0) {
    let achievements = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " +
        achievementsData[0].ContentId,
    });

    achievementsData[0]["achievements"] = achievements;
  }

  let categories = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 44",
  });

  let testimonialData = [];

  await asyncForEach(categories, async (ele) => {
    let testimonials = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " + ele.ContentId,
    });

    if (testimonials.length > 0) {
      testimonials.map((data) => {
        testimonialData.push(data);
      });
    }
  });

  res.send({
    pageData: pageData[0],
    sectionData,
    serviceData,
    studyData,
    blogsData,
    generalEventData,
    testimonialData,
    categories,
    achievementsData:
    achievementsData[0] && achievementsData[0]["achievements"],
  });
});

app.get("/services/:slug", async function (req, res) {
  const pageSlug = req.params.slug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  let servicePageData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 4",
  });

  let serviceData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 38",
  });

  res.send({
    serviceData: serviceData,
    servicePageData: servicePageData[0],
  });
});

app.get("/services/:userType/:serviceName", async function (req, res) {
  const { userType, serviceName } = req.params;

  let serviceSlug = userType + "/services/" + serviceName;

  let serviceData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + serviceSlug + "'",
  });

  let servicePrograms = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content_details WHERE ContentId = " +
      serviceData[0].ContentId,
  });

  res.send({
    serviceData: serviceData[0],
    servicePrograms,
  });
});

app.post("/services/edit/:slug", async function (req, res) {
  const { slug } = req.params;

  const formData = req.body;

  let serviceSlug = "/services/" + slug;

  let serviceData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
    values: [serviceSlug],
  });

  if (!serviceData || serviceData.length === 0) {
    res.status(404).send({
      status: 404,
      message: "Service not found",
    });
    return;
  }

  const contentSlug = formData.ContentSlug;
  delete formData.ContentSlug;

  let updateString = Object.keys(formData).map((key) => {
    return `${key} = ?`;
  });

  let updateValues = Object.values(formData);

  updateData = await mysqlQuery(con, {
    sql: `UPDATE rm_content SET ${updateString.join(", ")} WHERE ContentId = ?`,
    values: [...updateValues, serviceData[0].ContentId],
  });

  console.log(updateData);

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.post(
  "/blog/image-upload",
  upload.single("upload"),
  async function (req, res, next) {
    console.log("req files", req);
    try {
      res.json({
        url: `${process.env.VITE_API_URL}uploads/${req?.file?.filename}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/editService/:userType/:slug/:contentSlug",
  upload.single("Image1"),
  async function (req, res) {
    const { userType, slug, contentSlug } = req.params;

    const { body, file } = req;

    console.log({ body, file });

    const formData = req.body;

    let serviceSlug = userType + "/services/" + slug;

    let serviceData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
      values: [serviceSlug],
    });

    delete formData.ContentSlug;

    let updateData = "";
    if (contentSlug === "servicePrograms") {
      let contentData = Object.keys(formData).map((key) => {
        let data = {};
        data.ContentDetailId = key;
        if (formData[key].ContentTitle) {
          data.ContentTitle = formData[key].ContentTitle;
        }
        if (formData[key].ContentDescription) {
          data.ContentDescription = formData[key].ContentDescription;
        }

        return data;
      });

      contentData.map(async (ele) => {
        let updateString = Object.keys(ele).map((key) => {
          return `${key} = ?`;
        });
        let updateValues = Object.values(ele);
        updateData = await mysqlQuery(con, {
          sql: `UPDATE rm_content_details SET ${updateString.join(", ")} WHERE ContentDetailId = ?`,
          values: [...updateValues, ele.ContentDetailId],
        });
      });
    } else if (contentSlug === "serviceData") {
      console.log("form data", formData);
      let data = {};
      let contentData = [];
      if (Object.keys(formData).length > 0) {
        contentData = Object.keys(formData).map((key) => {
          data[key] = formData[key];
          data.Image1 = req?.file?.filename;
          return data;
        });
      } else {
        contentData.push({ Image1: req?.file?.filename });
      }

      console.log("content data", contentData);

      let updateString = Object.keys(contentData[0]).map((key) => {
        console.log("data key", contentData[0][key]);
        if (contentData[0][key] !== undefined) {
          return `${key} = ?`;
        }
      });
      console.log("update string", updateString);
      let updateValues = Object.values(contentData[0]).filter(Boolean);
      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content SET ${updateString.filter(Boolean).join(", ")} WHERE ContentSlug = ?`,
        values: [...updateValues, serviceSlug],
      });
    } else {
      let updateString = Object.keys(formData).map((key) => {
        return `${key} = ?`;
      });
      let updateValues = Object.values(formData).filter(Boolean);

      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content SET ${updateString.join(", ")} WHERE ContentId = ?`,
        values: [...updateValues, serviceData[0].ContentId],
      });
    }

    console.log(updateData);

    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);

app.post(
  "/editStudy/:userType/:slug/:contentSlug",
  upload.single("ContentImage"),
  async function (req, res) {
    const { userType, slug, contentSlug } = req.params;

    const { body, file } = req;

    console.log({ body, file });

    const formData = req.body;

    let serviceSlug = userType + "/case-studies/" + slug;

    let serviceData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
      values: [serviceSlug],
    });

    delete formData.ContentSlug;

    let updateData = "";
    if (contentSlug === "studyDetails") {
      console.log("form data", formData);
      if (formData.ContentDetailId === undefined) {
      }
      let data = {};
      let contentData = Object.keys(formData).map((key) => {
        data[key] = formData[key];
        data.ContentImage = req?.file?.filename;
        return data;
      });
      console.log("content data", contentData);

      let updateString = Object.keys(contentData[0]).map((key) => {
        console.log("data key", contentData[0][key]);
        if (contentData[0][key] !== undefined) {
          return `${key} = ?`;
        }
      });
      // console.log("update string", updateString);
      let updateValues = Object.values(contentData[0]).filter(Boolean);
      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content_details SET ${updateString.filter(Boolean).join(", ")} WHERE ContentDetailId = ?`,
        values: [...updateValues, contentData[0].ContentDetailId],
      });
    } else {
      console.log("form data", formData);
      let updateString = Object.keys(formData).map((key) => {
        return `${key} = ?`;
      });
      let updateValues = Object.values(formData).filter(Boolean);

      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content SET ${updateString.join(", ")} WHERE ContentId = ?`,
        values: [...updateValues, serviceData[0].ContentId],
      });
    }

    console.log(updateData);

    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);

app.get("/services/:slug", async function (req, res) {
  const pageSlug = req.params.slug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  let servicePageData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 4",
  });

  let serviceData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 38",
  });

  res.send({
    serviceData: serviceData,
    servicePageData: servicePageData[0],
  });
});

app.get("/about", async function (req, res) {
  const pageSlug = req.params.userType + "/about";

  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE Heading1 = 'Our Story'",
  });

  let coreValues = await mysqlQuery(con, {
    sql: "SELECT * from rm_content WHERE Heading1 = 'Core Values'",
  });

  let visionMission = await mysqlQuery(con, {
    sql: "SELECT * from rm_content WHERE (Heading1 = 'Mission' OR Heading1 = 'Vision')",
  });

  let awards = await mysqlQuery(con, {
    sql: "SELECT * from rm_content WHERE Heading1 = 'Awards'",
  });

  let partners = await mysqlQuery(con, {
    sql: "SELECT * from rm_content WHERE Heading1 = 'Partners' ",
  });

  let achievementsData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE PageId = 2 AND ContentTypeId = 7",
  });

  if (achievementsData.length > 0) {
    let achievements = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " +
        achievementsData[0].ContentId,
    });

    achievementsData[0]["achievements"] = achievements;
  }

  res.send({
    pageData: pageData[0],
    coreValues,
    visionMission,
    awards,
    partners,
    achievementsData,
    // achievements,
  });
});

app.get("/:slug/case-studies", async function (req, res) {
  const pageSlug = req.params.slug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  let StudyPageData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 6",
  });

  let studyDetails = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE ContentTypeId = 40 AND PageId = " +
      pageData[0].PageId +
      " order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  res.send({
    studyData: studyDetails,
    pageData: StudyPageData[0],
  });
});

app.get("/:slug/case-studies", async function (req, res) {
  const pageSlug = req.params.slug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  let StudyPageData = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content WHERE PageId = " +
      pageData[0].PageId +
      " AND ContentTypeId = 6",
  });

  let studyDetails = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 40",
  });

  res.send({
    studyData: studyDetails,
    pageData: StudyPageData[0],
  });
});

app.get(
  "/case-studies/:userType/case-studies/:slug",
  async function (req, res) {
    const { slug, userType } = req.params;

    const searchSlug = userType + "/case-studies/" + slug;

    let studyData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + searchSlug + "'",
    });

    let studyDetails = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " +
        studyData[0].ContentId,
    });

    res.send({
      studyData: studyData[0],
      studyDetails,
    });
  }
);

app.post("/case-studies/edit/:slug", async function (req, res) {
  const { slug } = req.params;

  const formData = req.body;

  let serviceSlug = "/caseStudies/" + slug;

  let serviceData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
    values: [serviceSlug],
  });

  const contentSlug = formData.ContentSlug;

  delete formData.ContentSlug;

  let updateString = Object.keys(formData).map((key) => {
    return `${key} = ?`;
  });
  let updateValues = Object.values(formData);

  updateData = await mysqlQuery(con, {
    sql: `UPDATE rm_content SET ${updateString.join(", ")} WHERE ContentId = ?`,
    values: [...updateValues, serviceData[0].ContentId],
  });

  console.log(updateData);

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.post("/editPage/:slug", async function (req, res) {
  let formData = req.body;
  const ContentSlug = formData.ContentSlug;
  const pageSlug = req.params.slug;
  let pageData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_pages WHERE PageSlug = '/" + pageSlug + "'",
  });

  if (formData.ContentSlug === "/metadata" || pageSlug === "about-us") {
    delete formData.ContentSlug;
  }

  let updateString = Object.keys(formData).map((key) => {
    return `${key} = ?`;
  });

  let updateValues = Object.values(formData);

  if (ContentSlug === "/metadata") {
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_pages SET ${updateString.join(", ")} WHERE PageId = ?`,
      values: [...updateValues, pageData[0].PageId],
    });
  } else if (pageSlug === "contact-us" || pageSlug === "about-us") {
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_content SET ${updateString} WHERE ContentId = ?`,
      values: [...updateValues, formData.ContentId],
    });
  } else if (pageSlug === "privacy-policy") {
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_content SET ${updateString} WHERE ContentTypeId = ?`,
      values: [...updateValues, 45],
    });
  } else if (pageSlug === "terms-&-conditions") {
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_content SET ${updateString} WHERE ContentTypeId = ?`,
      values: [...updateValues, 45],
    });
  } else {
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_content SET ${updateString} WHERE ContentSlug = ? AND PageId = ?`,
      values: [...updateValues, formData.ContentSlug, pageData[0].PageId],
    });
  }

  console.log(updateData);

  if (updateData) {
    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  } else {
    res.send({
      status: 500,
      message:
        "Details could not be submitted at this time. Please try again after sometime.",
    });
  }
});

app.get("/queries", async function (req, res) {
  let queries = await mysqlQuery(con, {
    sql: "SELECT * from `rm_queries` ORDER BY CreatedAt DESC",
  });

  res.send({
    queries,
  });
});

app.post("/submit-query-form", async function (req, res) {
  const formData = req.body;

  let insertData = await mysqlQuery(con, {
    sql:
      "INSERT INTO `rm_queries` (`FullName`, `CompanyName`, `Email`, `PhoneNumber`, `Jobtitle`, `Services`, `ReferralSource`, `Comment`) VALUES ('" +
      formData.FullName +
      "', '" +
      formData.CompanyName +
      "', '" +
      formData.Email +
      "', '" +
      formData.PhoneNumber +
      "', '" +
      formData.JobTitle +
      "', '" +
      formData.Services +
      "', '" +
      formData.ReferralSource +
      "', '" +
      formData.Comment +
      "')",
  });

  if (insertData) {
    res.send({
      status: 200,
      message:
        "Thank you for submitting your details. We will contact your shortly.",
    });
  } else {
    res.send({
      status: 500,
      message:
        "Details could not be submitted at this time. Please try again after sometime.",
    });
  }
});

app.post("/subscribers", async function (req, res) {
  const formData = req.body;

  let insertData = await mysqlQuery(con, {
    sql: "INSERT INTO `rm_subscribers` (`SubscriberEmail`) VALUES (?)",
    values: [formData.SubscriberEmail],
  });

  if (insertData) {
    res.send({
      status: 200,
      message:
        "Thank you for submitting your details. We will contact your shortly.",
    });
  } else {
    res.send({
      status: 500,
      message:
        "Details could not be submitted at this time. Please try again after sometime.",
    });
  }
});

app.get("/blogs", async function (req, res) {
  let blogData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = '41' order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  let blogDetails = [];

  await asyncForEach(blogData, async (ele) => {
    let data = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " + ele.ContentId,
    });

    blogDetails.push(data[0]);
    console.log("blog details", blogDetails);
  });

  res.send({
    blogData,
    blogDetails,
  });
});

app.get("/blogs/:slug", async function (req, res) {
  const { slug } = req.params;

  let blogData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + slug + "'",
  });

  let blogDetails = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content_details WHERE ContentId = " +
      blogData[0].ContentId,
  });

  res.send({
    blogData: blogData[0],
    blogDetails,
  });
});

app.post("/addBlog", upload.single("Image1"), async function (req, res) {
  const { body, file } = req;

  console.log({ body, file });

  const formData = req.body;

  let blogData = JSON.parse(formData.blogData);
  blogData.Image1 = req.file.filename;
  let blogDetails = JSON.parse(formData.blogDetails);
  let metadata = JSON.parse(formData.metadata);

  if (Object.keys(blogData).length > 0) {
    let updateData = await mysqlQuery(con, {
      sql: "INSERT into `rm_content` (`Heading1`, `Heading2`, `Image1`, `ContentSlug`, `PageId`, `ContentTypeId`, `MetaTitle`, `MetaDescription`, `MetaKeywords`, `OGTitle`, `OGDescription`, `CreatedOn`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      values: [
        blogData.Heading1,
        blogData.Heading2,
        blogData.Image1,
        convertToSlug(blogData.Heading1),
        "9",
        "41",
        metadata.MetaTitle || "",
        metadata.MetaDescription || "",
        metadata.MetaKeywords || "",
        metadata.OGTitle || "",
        metadata.OGDescription || "",
        blogData.CreatedOn || "",
      ],
    });

    if (updateData && Object.keys(blogDetails).length > 0) {
      await mysqlQuery(con, {
        sql: "INSERT into `rm_content_details` (`ContentTitle`, `ContentDescription`, `ContentId`) VALUES (?, ?, ?)",
        values: [
          blogDetails.ContentTitle,
          blogDetails.ContentDescription,
          updateData.insertId,
        ],
      });
    }
  }

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.post(
  "/editBlog/:slug/:contentSlug",
  upload.single("Image1"),
  async function (req, res) {
    const { slug, contentSlug } = req.params;

    const { body, file } = req;

    console.log({ body, file });

    const formData = req.body;

    let blogData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
      values: [slug],
    });

    delete formData.ContentSlug;

    let updateData = "";
    if (contentSlug === "blogData") {
      console.log("form data", formData);
      let data = {};
      let contentData = [];
      if (Object.keys(formData).length > 0) {
        Object.keys(formData).map((key) => {
          data[key] = formData[key];
          data.Image1 = req?.file?.filename;
          contentData.push(data);
        });
      } else {
        contentData.push({
          Image1: req?.file?.filename,
        });
      }

      console.log("content data", contentData);

      let updateString = Object.keys(contentData[0]).map((key) => {
        console.log("data key", contentData[0][key]);
        if (contentData[0][key] !== undefined) {
          console.log("inside if", contentData[0][key]);
          return `${key} = ?`;
        }
      });
      console.log("update string", updateString.filter(Boolean).join(", "));
      console.log("Object values", Object.values(contentData[0]));
      let updatedcontentData = Object.values(contentData[0]).filter(Boolean);
      updateString = updateString.filter(Boolean);
      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content SET ${updateString.filter(Boolean).join(", ")} WHERE ContentSlug = ?`,
        values: [...Object.values(updatedcontentData), slug],
      });
    } else {
      console.log("form data", formData);
      let updateString = Object.keys(formData).map((key) => {
        return `${key} = ?`;
      });

      if (contentSlug === "metadata") {
        updateData = await mysqlQuery(con, {
          sql: `UPDATE rm_content SET ${updateString.filter(Boolean).join(", ")} WHERE ContentSlug = ?`,
          values: [...Object.values(formData), slug],
        });
      } else {
        updateData = await mysqlQuery(con, {
          sql: `UPDATE rm_content_details SET ${updateString.filter(Boolean).join(", ")} WHERE ContentId = ?`,
          values: [...Object.values(formData), blogData[0].ContentId],
        });
      }
    }

    console.log(updateData);

    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);

app.get("/testimonialCategories", async function (req, res) {
  let categories = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 44",
  });

  res.send({
    categories,
  });
});

app.get("/testimonials/:id", async function (req, res) {
  let testimonialDetails = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content_details WHERE ContentDetailId = " +
      req.params.id,
  });

  res.send({
    testimonialDetails,
  });
});

app.get("/testimonials", async function (req, res) {
  let categories = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = 44 order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  let testimonialData = [];

  await asyncForEach(categories, async (ele) => {
    let testimonials = await mysqlQuery(con, {
      sql:
        "SELECT * FROM rm_content_details WHERE ContentId = " + ele.ContentId,
    });

    if (testimonials.length > 0) {
      testimonials.map((data) => {
        testimonialData.push(data);
      });
    }
  });

  res.send({
    categories,
    testimonialData,
  });
});

app.post(
  "/addTestimonial",
  upload.single("ContentImage"),
  async function (req, res) {
    const { body, file } = req;

    const formData = req.body;

    let testimonialData = JSON.parse(formData.testimonialDetails);
    testimonialData.AuthorImage = req.file.filename;

    if (Object.keys(testimonialData).length > 0) {
      await mysqlQuery(con, {
        sql: "INSERT into `rm_content_details` (`ContentTitle`,  `ContentDescription`, `ContentId`, `AuthorImage`) VALUES (?, ?, ?, ?)",
        values: [
          testimonialData.ContentTitle,
          testimonialData.ContentDescription,
          testimonialData.ContentId,
          testimonialData.AuthorImage,
        ],
      });
    }

    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);

app.post(
  "/editTestimonial/:id",
  upload.single("ContentImage"),
  async function (req, res) {
    const { id } = req.params;
    const { body, file } = req;

    const formData = req.body;

    let updateData = "";
    console.log("form data", formData);
    let data = {};
    let contentData = [];
    if (Object.keys(formData.testimonialDetails).length > 0) {
      Object.keys(formData.testimonialDetails).map((key) => {
        data[key] = formData.testimonialDetails[key];
        data.AuthorImage = req?.file?.filename;
        contentData.push(data);
      });
    } else {
      contentData.push({
        AuthorImage: req?.file?.filename,
      });
    }

    console.log("content data", contentData);

    let updateString = Object.keys(contentData[0]).map((key) => {
      console.log("data key", contentData[0][key]);
      if (contentData[0][key] !== undefined) {
        return `${key} = ?`;
      }
    });
    console.log("update string", updateString);
    let updatedcontentData = Object.values(contentData[0]).filter(Boolean);
    updateData = await mysqlQuery(con, {
      sql: `UPDATE rm_content_details SET ${updateString.filter(Boolean).join(", ")} WHERE ContentDetailId = ?`,
      values: [updatedcontentData, id],
    });

    console.log(updateData);

    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);

//General Events 

app.get("/generalEvents", async function (req, res) {
  let generalEventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentTypeId = '51' order by UNIX_TIMESTAMP(CreatedOn) DESC",
  });

  let generalEventDetails = [];

  await asyncForEach(generalEventData, async (ele) => {
    let data = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content_details WHERE ContentId = " + ele.ContentId,
    });

    generalEventDetails.push(data[0]);
  });

  res.send({
    generalEventData,
    generalEventDetails,
  });
});

app.get("/generalEvents/:slug", async function (req, res) {
  const { slug } = req.params;

  let generalEventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + slug + "'",
  });

  let generalEventDetails = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_content_details WHERE ContentId = " +
      generalEventData[0].ContentId,
  });

  res.send({
    generalEventData: generalEventData[0],
    generalEventDetails,
  });
});

app.post("/addGeneralEvent", upload.single("Image1"), async function (req, res) {
  const { body, file } = req;

  const formData = req.body;

  let generalEventData = JSON.parse(formData.generalEventData);
  generalEventData.Image1 = req.file.filename;
  let generalEventDetails = JSON.parse(formData.generalEventDetails);
  let metadata = JSON.parse(formData.metadata);

  if (Object.keys(generalEventData).length > 0) {
    let updateData = await mysqlQuery(con, {
      sql: "INSERT into `rm_content` (`Heading1`, `Heading2`, `Image1`, `ContentSlug`, `PageId`, `ContentTypeId`, `MetaTitle`, `MetaDescription`, `MetaKeywords`, `OGTitle`, `OGDescription`, `CreatedOn`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      values: [
        generalEventData.Heading1,
        generalEventData.Heading2,
        generalEventData.Image1,
        convertToSlug(generalEventData.Heading1),
        "5", // PageId, adjust as needed
        "51", // ContentTypeId for general event
        metadata.MetaTitle || "",
        metadata.MetaDescription || "",
        metadata.MetaKeywords || "",
        metadata.OGTitle || "",
        metadata.OGDescription || "",
        generalEventData.CreatedOn || "",
      ],
    });

    if (updateData && Object.keys(generalEventDetails).length > 0) {
      await mysqlQuery(con, {
        sql: "INSERT into `rm_content_details` (`ContentTitle`, `ContentDescription`, `ContentId`) VALUES (?, ?, ?)",
        values: [
          generalEventDetails.ContentTitle,
          generalEventDetails.ContentDescription,
          updateData.insertId,
        ],
      });
    }
  }

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.post(
  "/editGeneralEvent/:slug/:contentSlug",
  upload.single("Image1"),
  async function (req, res) {
    const { slug, contentSlug } = req.params;

    const { body, file } = req;
    console.log({ body, file });

    const formData = req.body;

    let generalEventData = await mysqlQuery(con, {
      sql: "SELECT * FROM rm_content WHERE ContentSlug = ?",
      values: [slug],
    });

    delete formData.ContentSlug;

    let updateData = "";
    if (contentSlug === "generalEventData") {
      let data = {};
      let contentData = [];
      if (Object.keys(formData).length > 0) {
        Object.keys(formData).map((key) => {
          data[key] = formData[key];
          data.Image1 = req?.file?.filename;
          contentData.push(data);
        });
      } else {
        contentData.push({
          Image1: req?.file?.filename,
        });
      }
      console.log("content data", contentData);


      let updateString = Object.keys(contentData[0]).map((key) => {
        console.log("data key", contentData[0][key]);
        if (contentData[0][key] !== undefined) {
          console.log("inside if", contentData[0][key]);
          return `${key} = ?`;
        }
      });
      console.log("update string", updateString.filter(Boolean).join(", "));
      console.log("Object values", Object.values(contentData[0]));
      let updatedcontentData = Object.values(contentData[0]).filter(Boolean);
      updateString = updateString.filter(Boolean);
      updateData = await mysqlQuery(con, {
        sql: `UPDATE rm_content SET ${updateString.filter(Boolean).join(", ")} WHERE ContentSlug = ?`,
        values: [...Object.values(updatedcontentData), slug],
      });
    } else {
      let updateString = Object.keys(formData).map((key) => {
        return `${key} = ?`;
      });

      if (contentSlug === "metadata") {
        updateData = await mysqlQuery(con, {
          sql: `UPDATE rm_content SET ${updateString.filter(Boolean).join(", ")} WHERE ContentSlug = ?`,
          values: [...Object.values(formData), slug],
        });
      } else {
        updateData = await mysqlQuery(con, {
          sql: `UPDATE rm_content_details SET ${updateString.filter(Boolean).join(", ")} WHERE ContentId = ?`,
          values: [...Object.values(formData), generalEventData[0].ContentId],
        });
      }
    }
    console.log(updateData);
    res.send({
      status: 200,
      message: "Data updated successfully",
    });
  }
);
//-----------------//

app.post("/addEvent", upload.single("Image1"), async function (req, res) {
  const { body, file } = req;

  console.log({ body, file });

  const formData = req.body;

  let eventData = JSON.parse(formData.eventData);
  eventData.Image1 = req.file.filename;
  let eventSchedule = JSON.parse(formData.eventSchedule);
  let eventAgenda = JSON.parse(formData.eventAgenda);
  let updateData = "";
  if (Object.keys(eventData).length > 0) {
    updateData = await mysqlQuery(con, {
      sql:
        "INSERT into `rm_content` (`Heading1`,  `Heading2`, `SubHeading1`, `SubHeading2`, `Image1`, `PageId`, `ContentTypeId`, `ContentSlug`, `Address1`, `EventDate`, `Status`, `Description`) VALUES ('" +
        eventData.Heading1 +
        "', '" +
        eventData.Heading2 +
        "', '" +
        eventData.SubHeading1 +
        "', '" +
        eventData.SubHeading2 +
        "', '" +
        eventData.Image1 +
        "', '0', '47', '" +
        (eventData.ContentSlug || "") +
        "','" +
        (eventData.Address1 || "") +
        "','" +
        (eventData.EventDate || "") +
        "','" +
        eventData.Status +
        "','" +
        (eventData.Description || "") +
        "')",
    });
  }

  if (updateData && Object.keys(eventSchedule).length > 0) {
    eventSchedule.map(async (rowData) => {
      await mysqlQuery(con, {
        sql:
          "INSERT into `rm_event_schedule` (`Title`,  `Date`, `EventId`) VALUES ('" +
          rowData.Title +
          "', '" +
          rowData.Date +
          "', '" +
          updateData.insertId +
          "')",
      });
    });
  }

  if (updateData && Object.keys(eventAgenda).length > 0) {
    eventAgenda.map(async (rowData) => {
      await mysqlQuery(con, {
        sql:
          "INSERT into `rm_event_agenda` (`Title`,  `Time`, `Description`, `EventId`) VALUES ('" +
          rowData.Title +
          "', '" +
          rowData.Time +
          "', '" +
          rowData.Description +
          "', '" +
          updateData.insertId +
          "')",
      });
    });
  }

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.post("/editEvent/:id", upload.single("Image1"), async function (req, res) {
  const { id } = req.params;
  const { body, file } = req;

  const formData = req.body;

  let updateData = "";
  console.log("form data", JSON.parse(formData.eventData));
  let data = {};
  let eventData = JSON.parse(formData.eventData)[0];
  let eventSchedule = JSON.parse(formData.eventSchedule);
  let eventAgenda = JSON.parse(formData.eventAgenda);

  delete eventData["CreatedOn"];
  delete eventData["ModifiedOn"];
  eventData["EventDate"] = moment(eventData["EventDate"]).format("YYYY-MM-DD");
  eventData["Image1"] = req?.file?.filename;

  let updateString = Object.keys(eventData).map((key) => {
    return `${key} = ?`;
  });

  let updateValues = Object.values(eventData);

  updateData = await mysqlQuery(con, {
    sql: `UPDATE rm_content SET ${updateString.join(", ")} WHERE ContentId = ?`,
    values: [...updateValues, id],
  });

  if (updateData && Object.keys(eventSchedule).length > 0) {
    await mysqlQuery(con, {
      sql: "DELETE FROM `rm_event_schedule` WHERE EventId = '" + id + "'",
    });
    eventSchedule?.map(async (rowData) => {
      await mysqlQuery(con, {
        sql:
          "INSERT into `rm_event_schedule` (`Title`,  `Date`, `EventId`) VALUES ('" +
          rowData.Title +
          "', '" +
          moment(rowData.Date).format("YYYY-MM-DD") +
          "', '" +
          id +
          "')",
      });
    });
  }

  if (updateData && Object.keys(eventAgenda).length > 0) {
    await mysqlQuery(con, {
      sql: "DELETE FROM `rm_event_agenda` WHERE EventId = '" + id + "'",
    });

    eventAgenda?.map(async (rowData) => {
      await mysqlQuery(con, {
        sql:
          "INSERT into `rm_event_agenda` (`Title`,  `Time`, `Description`, `EventId`) VALUES ('" +
          rowData.Title +
          "', '" +
          rowData.Time +
          "', '" +
          rowData.Description +
          "', '" +
          id +
          "')",
      });
    });
  }

  res.send({
    status: 200,
    message: "Data updated successfully",
  });
});

app.get("/events/:id", async function (req, res) {
  let eventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentId = '" + req.params.id + "'",
  });

  console.log("event data", eventData);
  let eventSchedule = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_event_schedule WHERE EventId = " +
      eventData[0].ContentId,
  });
  let eventAgenda = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_event_agenda WHERE EventId = " + eventData[0].ContentId,
  });

  res.send({
    eventData,
    eventSchedule,
    eventAgenda,
  });
});

app.get("/events", async function (req, res) {
  let eventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content where ContentTypeId = 47 order by UNIX_TIMESTAMP(EventDate) DESC",
  });

  res.send({
    eventsData: eventData,
  });
});

app.get("/events/hackathon/:eventCategory/:slug", async function (req, res) {
  let eventSlug =
    "hackathon/" + req.params.eventCategory + "/" + req.params.slug;
  let eventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + eventSlug + "/'",
  });

  console.log("event data", eventData);
  let eventSchedule = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_event_schedule WHERE EventId = " +
      eventData[0].ContentId,
  });
  let eventAgenda = await mysqlQuery(con, {
    sql:
      "SELECT * FROM rm_event_agenda WHERE EventId = " + eventData[0].ContentId,
  });

  res.send({
    eventData,
    eventSchedule,
    eventAgenda,
  });
});

app.use(session({
  secret: 'your-secret-key', // Replace with a secure secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure: true if using HTTPS in production
}));

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REDIRECT_URI = process.env.ZOHO_REDIRECT_URI;

// Endpoint for OAuth callback and token exchange
app.get("/auth/zoho/callback", async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) {
    return res.status(400).send("Authorization code is missing.");
  }

  try {
    const response = await axios.post(
      "https://accounts.zoho.com/oauth/v2/token",
      qs.stringify({
        code: authCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code", // Grant type is authorization_code for exchanging the code for tokens
      })
    );

    // Save the access and refresh tokens in the session
    req.session.accessToken = response.data.access_token;
    req.session.refreshToken = response.data.refresh_token;

    console.log("Access Token:", response.data.access_token);
    console.log("Refresh Token:", response.data.refresh_token);

    res.redirect("/jobs"); // Redirect to the job listings page or a page of your choice
  } catch (error) {
    console.error("Error exchanging authorization code for tokens:", error.response?.data || error);
    res.status(500).send("Failed to authenticate.");
  }
});

// Endpoint to fetch job listings from Zoho Recruit
app.get("/api/jobs", async (req, res) => {
  let accessToken = req.session.accessToken; // Get access token from session
  let refreshToken = req.session.refreshToken; // Get refresh token from session

  if (!accessToken) return res.status(401).send("Unauthorized. Access token is missing.");

  try {
    // Try to fetch job listings
    const response = await axios.get("https://recruit.zoho.com/recruit/v2/JobOpenings", {
      headers: {
        Authorization: `Bearer ${accessToken}`, // Send the access token in the Authorization header
      },
    });

    const jobListings = response.data.data; // Get the job postings
    res.json(jobListings); // Send the job listings as JSON to the frontend

  } catch (error) {
    // If the access token has expired, refresh it using the refresh token
    if (error.response?.status === 401) {
      console.log("Access token expired, refreshing...");

      const refreshResponse = await axios.post(
        "https://accounts.zoho.com/oauth/v2/token",
        qs.stringify({
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token", // Grant type for refreshing the token
        })
      );

      const newAccessToken = refreshResponse.data.access_token;
      const newRefreshToken = refreshResponse.data.refresh_token;

      // Save the new tokens in the session
      req.session.accessToken = newAccessToken;
      req.session.refreshToken = newRefreshToken;

      // Retry fetching the job listings with the new access token
      const retryResponse = await axios.get("https://recruit.zoho.com/recruit/v2/JobOpenings", {
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
        },
      });

      const jobListings = retryResponse.data.data;
      res.json(jobListings); // Send the job listings as JSON
    } else {
      // Handle any other errors
      console.error("Error fetching job postings:", error.response?.data || error);
      res.status(500).send("Failed to fetch job postings.");
    }
  }
});

// Sample route for event data (your existing code)
app.get("/events/hackathon/:eventCategory/:slug", async function (req, res) {
  let eventSlug = "hackathon/" + req.params.eventCategory + "/" + req.params.slug;
  let eventData = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_content WHERE ContentSlug = '" + eventSlug + "/'",
  });

  console.log("event data", eventData);
  let eventSchedule = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_event_schedule WHERE EventId = " + eventData[0].ContentId,
  });
  let eventAgenda = await mysqlQuery(con, {
    sql: "SELECT * FROM rm_event_agenda WHERE EventId = " + eventData[0].ContentId,
  });

  res.send({
    eventData,
    eventSchedule,
    eventAgenda,
  });
});

// ------------------------ AWS S3 Configuration ------------------------
if (
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY ||
  !process.env.AWS_REGION ||
  !process.env.S3_BUCKET_NAME
) {
  console.error("AWS configuration variables are not set. Exiting...");
  process.exit(1);
}

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;


// ------------------------ Middleware ------------------------
app.use(
  cors({
    origin: ["http://localhost:5173", "https://rareminds.in", "http://localhost:3000","https://dev.rareminds.in"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());

// ------------------------ Helper Function to Fetch Distinct Filter Options ------------------------
const fetchFilterOptions = async () => {
  try {
    const filterQuery = `
      SELECT DISTINCT university, year, semester, course
      FROM gallery
    `;
    const filterResult = await mysqlQuery(con, { sql: filterQuery });
    
    // Extract distinct values for each filter
    const universities = [...new Set(filterResult.map(item => item.university))];
    const years = [...new Set(filterResult.map(item => item.year))];
    const semesters = [...new Set(filterResult.map(item => item.semester))];
    const courses = [...new Set(filterResult.map(item => item.course))];

    return { universities, years, semesters, courses };
  } catch (error) {
    console.error("Failed to fetch filter options:", error.message);
    throw new Error("Failed to fetch filter options.");
  }
};
// ------------------------ Routes ------------------------

// Route to fetch filter options
app.get("/api/filter-options", async (req, res) => {
  try {
    const filterOptions = await fetchFilterOptions();
    res.json(filterOptions);
  } catch (error) {
    console.error("Failed to fetch filter options:", error.message);
    res.status(500).json({ error: "Failed to fetch filter options." });
  }
});

app.get("/api/metadata", async (req, res) => {
  try {
    const filterOptions = await fetchFilterOptions();
    res.json(filterOptions); // Return the metadata in the expected format
  } catch (error) {
    console.error("Failed to fetch metadata:", error.message);
    res.status(500).json({ error: "Failed to fetch metadata." });
  }
});


// Route to fetch images with dynamic filters
app.get("/api/images", async (req, res) => {
  const { search, event_name, university, year, semester, course } = req.query;

  try {
    // Build the SQL query dynamically based on provided filters
    let sqlQuery = "SELECT image_url, event_name, event_date, university, year, semester, course FROM gallery WHERE 1=1";

    // Add filters to the query if provided
    if (search) {
      sqlQuery += ` AND event_name LIKE '%${search}%'`; // Search by event name (partial match)
    }
    if (event_name) {
      sqlQuery += ` AND event_name LIKE '%${event_name}%'`;
    }
    if (university) {
      sqlQuery += ` AND university = '${university}'`;
    }
    if (year) {
      sqlQuery += ` AND year = '${year}'`;
    }
    if (semester) {
      sqlQuery += ` AND semester = '${semester}'`;
    }
    if (course) {
      sqlQuery += ` AND course = '${course}'`;
    }

    // Fetch images from S3 (as before)
    const images = await fetchImagesFromS3();

    // Fetch gallery metadata from MySQL
    const metadataResult = await mysqlQuery(con, { sql: sqlQuery });

    // Combine image URLs with metadata
    const galleryData = images.map((image) => {
      const metadata = metadataResult.find((item) => item.image_url === image);
      return {
        image_url: image,
        event_name: metadata ? metadata.event_name : "Unknown",
        event_date: metadata ? metadata.event_date : "Unknown",
        university: metadata ? metadata.university : "Unknown",
        year: metadata ? metadata.year : "Unknown",
        semester: metadata ? metadata.semester : "Unknown",
        course: metadata ? metadata.course : "Unknown",
      };
    });

    res.json({ images: galleryData });
  } catch (error) {
    console.error("Failed to fetch images and metadata:", error.message);
    res.status(500).json({ error: "Failed to fetch images and metadata from the database." });
  }
});

// ------------------------ Route for Gallery(admin dashboard)------------------------

app.get("/gallery", async (req, res) => {
  console.log("Gallery API endpoint hit"); 
  const { page = 1, limit = 10 } = req.query; 
  try {
    // Query to fetch paginated gallery data with metadata
    const galleryQuery = `
      SELECT image_url, event_name, event_date, university, course, semester, year
      FROM gallery
      ORDER BY event_date DESC
      LIMIT ?,?;
    `;
    const metadataQuery = `
      SELECT COUNT(*) as total_count FROM gallery;
    `;

    const limitValue = parseInt(limit, 10); 
    const offsetValue = (parseInt(page, 10) - 1) * limitValue;

    // Fetch the data for the current page
    let galleryData = await mysqlQuery(con, { sql: "SELECT * FROM gallery" });
    if (!Array.isArray(galleryData)) {
      throw new Error('Expected galleryData to be an array');
    }

    // Fetch total count for pagination
    const [totalData] = await mysqlQuery(con, { sql: metadataQuery });

    // Format the data in the way the frontend expects
    const formattedGalleryData = galleryData.map((item) => ({
      ImageURL: item.image_url,
      EventName: item.event_name,
      EventDate: item.event_date,
      University: item.university,
      Course: item.course,
      Semester: item.semester,
      Year: item.year,
    }));

    // Send the data as a response
    res.json({
      galleryData: formattedGalleryData,
      totalCount: totalData.total_count,
    });
  } catch (error) {
    console.error("Error fetching gallery data:", error.message);
    res.status(500).json({ error: "Failed to fetch gallery data." });
  }
});

// ------------------------ Route to Delete Gallery Item ------------------------
app.delete("/gallery/:ImageURL", async (req, res) => {
  const { ImageURL } = req.params;
  console.log(`Attempting to delete gallery item : ${ImageURL}`); 

  try {
    // Step 1: Fetch the image URL from MySQL based on the given ID
    const query = "SELECT image_url FROM gallery WHERE image_url = ?";
    const result = await mysqlQuery(con, { sql: query, values: [ImageURL] });

    if (result.length === 0) {
      console.log(`No gallery item found with ID: ${ImageURL}`);
      return res.status(404).json({ error: "Gallery item not found." });
    }

    const imageUrl = result[0].image_url;
    console.log(`Image URL fetched: ${imageUrl}`);

    // Step 2: Delete the image from S3
    const s3Key = imageUrl.split('amazonaws.com/')[1];  // Extract the S3 key from the URL
    const s3Params = {
      Bucket: bucketName,
      Key: s3Key
    };

    await s3.deleteObject(s3Params).promise(); 
    console.log(`Image deleted from S3 with key: ${s3Key}`); // Delete the image from S3

    // Step 3: Delete the gallery item metadata from MySQL
    const deleteQuery = "DELETE FROM gallery WHERE image_url = ?";
    await mysqlQuery(con, { sql: deleteQuery, values: [imageUrl] });

    // Step 4: Respond to the client
    res.status(200).json({ message: "Gallery item deleted successfully." });
  } catch (error) {
    console.error("Error deleting gallery item:", error.message);
    res.status(500).json({ error: "Failed to delete gallery item." });
  }
});


// ------------------------ Helper Functions ------------------------
const fetchImagesFromS3 = async () => {
  const params = {
    Bucket: bucketName,
    Prefix: "images/",
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents.filter((item) =>
      [".jpg", ".jpeg", ".png", ".JPG"].some((ext) => item.Key.endsWith(ext))
    ).map((item) => {
      const encodedKey = item.Key.split("/").map(encodeURIComponent).join("/");
      return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodedKey}`;
    });
  } catch (err) {
    console.error("Error fetching images from S3:", err.message);
    throw new Error("Failed to fetch images from S3.");
  }
};

const uploadImageToS3 = async (file) => {
  if (!file || !file.buffer) {
    throw new Error("No file or file buffer is missing.");
  }

  const params = {
    Bucket: bucketName,
    Key: `images/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (err) {
    console.error("Error uploading image to S3:", err.message);
    throw new Error("Failed to upload image to S3.");
  }
};

// ------------------------ Routes ------------------------

// Route to fetch images for the events gallery page
app.get("/api/images", async (req, res) => {
  const { search, event_name, university, year, semester, course } = req.query;
  const queryParams = [];
  let sqlQuery = "SELECT image_url, event_name, event_date, university, year, semester, course FROM gallery WHERE 1=1";

  // Add filters to the query if provided
  if (search) {
    sqlQuery += ` AND event_name LIKE ?`; // Use placeholders
    queryParams.push(`%${search}%`);
  }
  if (event_name) {
    sqlQuery += ` AND event_name LIKE ?`;
    queryParams.push(`%${event_name}%`);
  }
  if (university) {
    sqlQuery += ` AND university = ?`;
    queryParams.push(university);
  }
  if (year) {
    sqlQuery += ` AND year = ?`;
    queryParams.push(year);
  }
  if (semester) {
    sqlQuery += ` AND semester = ?`;
    queryParams.push(semester);
  }
  if (course) {
    sqlQuery += ` AND course = ?`;
    queryParams.push(course);
  }

    try{
    // Fetch image URLs from S3 (as before)
    const images = await fetchImagesFromS3();

    // Fetch gallery metadata from MySQL
    const metadataQuery = "SELECT image_url, event_name, event_date, university, year, semester, course FROM gallery";
    const metadataResult = await mysqlQuery(con, { sql: metadataQuery });

    // Combine image URLs with metadata
    const galleryData = images.map((image) => {
      const metadata = metadataResult.find((item) => item.image_url === image);
      return {
        image_url: image,
        event_name: metadata ? metadata.event_name : "Unknown",
        event_date: metadata ? metadata.event_date : "Unknown",
        university: metadata ? metadata.university : "Unknown",
        year: metadata ? metadata.year : "Unknown",
        semester: metadata ? metadata.semester : "Unknown",
        course: metadata ? metadata.course : "Unknown",
      };
    });

    res.json({ images: galleryData });
  } catch (error) {
    console.error("Failed to fetch images and metadata:", error.message);
    res.status(500).json({ error: "Failed to fetch images and metadata from the database." });
  }
});



// Multer configuration for handling file uploads
const imgupload = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 1024 * 1024 * 5 },
});

// Route to handle gallery data submission and image upload
app.post("/addGallery", imgupload.single("image"), async (req, res) => {
  const { eventName, event_date, university, year, semester, course } = req.body;

  // Validate required fields
  if (!eventName || !event_date || !university || !year || !semester || !course || !req.file) {
    return res.status(400).json({ error: "All fields, including an image, are required." });
  }

  try {
    // Upload the file to S3 and get the URL
    const imageUrl = await uploadImageToS3(req.file);

    // Insert gallery metadata into MySQL
    const insertQuery = `
      INSERT INTO gallery (image_url, event_name, event_date, university, year, semester, course)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await mysqlQuery(con, {
      sql: insertQuery,
      values: [imageUrl, eventName, event_date, university, year, semester, course],
    });

    res.status(200).json({ message: "Gallery data added successfully", imageUrl });
  } catch (error) {
    console.error("Failed to upload image and insert metadata:", error.message);
    res.status(500).json({ error: "Failed to upload image and insert metadata into the gallery." });
  }
});


// ------------------------ Start the Server ------------------------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
