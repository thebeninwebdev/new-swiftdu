import {NextResponse} from "next/server"
import {connectMongoDB} from "../../../../utils/database"
import User from "../../../../models/user"
import {Resend} from 'resend'
import { EmailTemplate } from "@/components/verifyEmailTemplate"
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req:Request){
    try{
        const {name, email, password, username, phoneNumber } = await req.json()

        await connectMongoDB()

        if(!name || !email || !password || !username || !phoneNumber){
            console.log(name,email,password,username, phoneNumber)
            return NextResponse.json(
                {message:"All fields are required"},
                {status: 400}
            )
        }

        const existingEmail = await User.findOne({email}).select("_id")

        if (existingEmail) {
            return NextResponse.json({ message: 'Email already used' }, { status: 409 });
        }

        const existingUser = await User.findOne({username}).select("_id")

        if (existingUser) {
            return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
        }
        const user = await User.create
        ({
            name, 
            email, 
            password, 
            username, 
            roles:["customer"],
            created_at:new Date(),
            phone:phoneNumber
        })

        const verifyToken = await crypto.randomBytes(20).toString('hex')

        const emailVerifyToken = crypto.createHash("sha256").update(verifyToken).digest("hex")
    
        const emailVerifyExpires = Date.now() + 3600000
    
        user.verifyToken = emailVerifyToken
    
        user.verifyTokenExpiry = emailVerifyExpires
    
        await user.save()
    
        const verifyUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email/${verifyToken}`
    
        const { data, error } = await resend.emails.send({
            from: 'mrEseosa_ <hello@mreseosa.com>',
            to: [email],
            subject: 'Verify Account',
            react: EmailTemplate({ link: verifyUrl }),
            html: ""
          });
      
          if (error) {
            console.log(error)
            return Response.json({ error }, { status: 500 });
          }

          return NextResponse.json({message:"user registered, check your email"}, {status: 201})

    } catch(error){
        console.log(error)
        return NextResponse.json({
            message: "An error occured while registering the user."
        },
    {status: 500})
    }
}