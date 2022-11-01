import type { NextApiRequest, NextApiResponse } from "next";
import  { createRouter }  from "next-connect";
import connectDB, { closeDB } from "@server/config/database";
import web3userDb from "@server/models/cohortUsers";
import web2UserDb from "@server/models/web2";
import {  registrationSchema } from "schema";
import { PaymentStatus, Tracks } from "enums";
import validate from "@server/validate";
import { sendSms } from "@server/sms";
import { sendEmail } from "@server/mailer";
import {ISmsData} from "types"
import reportError from "@server/services/report-error";
import cloudinary from "@server/config/cloudinary";

const REGISTRATION_CLOSED=true;

const router = createRouter<NextApiRequest, NextApiResponse>();

router
// .use(async (req, res, next) => {
//   // this serve as the error handling middleware
//   let schema;
//   if((req.body.currentTrack || req.query.currentTrack) == "web2"){
//     schema =registrationSchema.web2
//   }
//   else{
//     schema =registrationSchema.web3
//   }
//   await validate(schema)(req, res, next)
// })

// create a user
.post(async (req: NextApiRequest, res: NextApiResponse) => {
 if(REGISTRATION_CLOSED){
return res.status(423).json({
      message: "registration closed",
      status: false,
    });
}
  let userDb;
  if(req.body.currentTrack === "web2"){
    userDb = web2UserDb
  }

  if(req.body.currentTrack === "web3"){
    userDb = web3userDb
  }

  if(Object.values(Tracks).indexOf(req.body.currentTrack) === -1){
    return res
    .status(400)
    .send({ status: false, error: "Invalid track" });
  }
  const { email, phone, currentTrack,name
  } = req.body;
  
  try {
    await connectDB();
    const [userExists, phoneExists] = await Promise.all([userDb.findOne({ email }), userDb.findOne({ phone})]);

    if(userExists?.paymentStatus ===PaymentStatus.success){
      await closeDB();
      return res
        .status(423)
        .send({ status: false, error: `This user already exists ${userExists.paymentStatus===PaymentStatus.success ? 'and your payment has been verified' :'click below to complete your payment'}`, paymentStatus:userExists.paymentStatus ?? PaymentStatus.pending });
    }




   
    if (userExists) {
      await closeDB();
      return res
        .status(423)
        .send({ status: false, error: `This user already exists ${userExists.paymentStatus===PaymentStatus.success ? 'and your payment has been verified' :'click below to complete your payment'}`, paymentStatus:userExists.paymentStatus ?? PaymentStatus.pending });
    }





    
    // const {url} = await cloudinary.uploader.upload(profilePicture, {});

    const userData: any = new userDb({
      ...req.body,
      paymentStatus: PaymentStatus.pending
      // profilePicture: url,
    }, 
);

    const { _doc } = await userData.save();

    await closeDB();

    return res.status(201).json({ message: currentTrack==='web3'? "Registration was successful, please check your email for further instructions" : "registration submitted successfully", ..._doc });
  } catch (e) {

    reportError(`error occurred at ${__filename}\n environment:${process.env.NODE_ENV}\n ${e} `)
  
    console.log("Error occuredd", e);
    return res.status(423).json({
      error: e,
      status: false,
    });
  }
});

interface IQuery {
  currentTrack?: string | string[] | undefined;
  page?: number | string;
}

router
// .get(async (req, res) => {
//   let userDb;
//   if(req.query.currentTrack === "web2"){
//     userDb = web2UserDb
//   }

//   if(req.query.currentTrack === "web3"){
//     userDb = web3userDb
//   }
  
//   const { currentTrack }: IQuery = req.query;

//   try {
//     const data = await web3userDb.find({})
//     console.log(data, currentTrack)
//     return res.status(200).json({
//       status: true,
//       message:data
//     })
//   } catch (e) {
//     return res.status(500).json({
//       status: false,
//       error: "server error",
//     });
//   }
// })
.get(async (req, res) => {
  let userDb;

    if(req.query.currentTrack === "web2"){
    userDb = web2UserDb
  }

  if(req.query.currentTrack === "web3"){
    userDb = web3userDb
  }
  

  const { currentTrack, page }: IQuery = req.query;

  try {
    // const users = await web3userDb.find({
    //   email:'okel@'
    //   // ...(!!currentTrack && { currentTrack }),
    // });

  const re =  await  web2UserDb.find({})
console.log(web2UserDb, web3userDb, re)
    return res.status(200).json({
      status: true,
      data:' users',
    });
  } catch (e) {
    reportError
    return res.status(500).json({
      status: false,
      error: "server error" + e,
    });
  }
});

export default router.handler({
  // @ts-ignore
  onError: (err, req, res, next) => {
    console.error(err.stack);
    reportError(err)
    res.status(500).end("Something broke!");
  },
  onNoMatch: (req, res) => {
    res.status(404).end("Page is not found");
  },
});
