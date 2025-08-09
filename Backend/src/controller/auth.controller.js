const bcrypt = require("bcrypt");
const {User} = require("../models/users.model");
const {generateAccessToken,generateRefreshToken} = require("../service/auth.service"); // ✅ Import properly


// Sign Up
const handleUserSignUp = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Bad Request: Neccesary marked fields are required"
  });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(403).json({
                message: "Forbidden: User already exist."
            });
    }

    const saltRound=await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password,saltRound);

    const user=await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });
    if(!user) return res.status(500).json({message:"user creation failed"});
    return res.status(201).json({message:'user created successfully'});
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const handleUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Email or password is invalid." });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "Email or password is invalid." });
    }

    console.log(`User login: ${email}, Valid password: ${isValid}`);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      // sameSite: 'Strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === 'production',
      // sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Logout
const handleUserLogout = (req, res) => {
  try{
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  return res.status(200).json({
            message: "Logout successful, cookies cleared"
        });
  }catch(error){
     return res.status(500).json({
            message: `Error at Logout -> ${error.message}`
        });
  }
};

module.exports = {
  handleUserSignUp,
  handleUserLogin,
  handleUserLogout,
};