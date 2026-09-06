import React from "react";

// react page for login
const Login = () => {
    return (
        <main>
            <div className="form">
                <h1>Login</h1>
                
                <form action="">
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" name="email" placeholder="Enter your email" />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" name="password" placeholder="Enter your password" />
                    </div>
                    <div className="button primary-button">
                        <button className="btn">Login</button>
                    </div>
                </form>
            </div>
        </main>
    );
};

export default Login;