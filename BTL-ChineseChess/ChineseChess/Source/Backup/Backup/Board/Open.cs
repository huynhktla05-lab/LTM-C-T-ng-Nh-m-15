using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Text;
using System.IO;
using System.Windows.Forms;

namespace Board
{
    public partial class Open : Form
    {
        bool file_exist = false;
        DirectoryInfo myDir = new DirectoryInfo(Application.StartupPath + "\\save");
        List<string> fileList = new List<string>();
        public Open()
        {
            InitializeComponent();
            if (myDir.Exists)
            {
                foreach (FileInfo file in myDir.GetFiles())
                {
                    file_exist = true;
                    fileList.Add(file.Name.Substring(0, file.Name.Length - 4));
                }
                if (file_exist)
                {
                    listBox1.DataSource = fileList;
                }
            }      
        }

        private void pictureBox1_MouseEnter(object sender, EventArgs e)
        {
            pictureBox1.Image = Board.Properties.Resources.cCancel_MouseOver;
        }

        private void pictureBox1_MouseLeave(object sender, EventArgs e)
        {
            pictureBox1.Image = Board.Properties.Resources.cCancel;
        }

        private void pictureBox1_MouseClick(object sender, MouseEventArgs e)
        {
            this.Close();
        }

        private void pictureBox2_MouseEnter(object sender, EventArgs e)
        {
            pictureBox2.Image = Board.Properties.Resources.Play_MouseOver;
        }

        private void pictureBox2_MouseLeave(object sender, EventArgs e)
        {
            pictureBox2.Image = Board.Properties.Resources.Play;
        }

        private void pictureBox2_MouseClick(object sender, MouseEventArgs e)
        {
            VanCo.Open(Application.StartupPath + "\\save\\" + Convert.ToString(listBox1.SelectedValue) + ".ccb");
            VanCo.DangChoi = true;
            this.Close();
        }

        private void pictureBox3_MouseEnter(object sender, EventArgs e)
        {
            pictureBox3.Image = Board.Properties.Resources.Del_MouseOver;
        }

        private void pictureBox3_MouseLeave(object sender, EventArgs e)
        {
            pictureBox3.Image = Board.Properties.Resources.Del;
        }

        private void pictureBox3_MouseClick(object sender, MouseEventArgs e)
        {
            FileInfo fileDel = new FileInfo(Application.StartupPath + "\\save\\" + Convert.ToString(listBox1.SelectedValue) + ".ccb");
            List<string> newfileList = new List<string>();
            fileDel.Delete();
            if (myDir.Exists)
            {
                foreach (FileInfo file in myDir.GetFiles())
                {
                    file_exist = true;
                    newfileList.Add(file.Name.Substring(0, file.Name.Length - 4));
                }
                if (file_exist)
                {
                    listBox1.DataSource = newfileList;
                }
            }    
            
        }

        private void button1_Click(object sender, EventArgs e)
        {
            VanCo.Open(Application.StartupPath + "\\save\\" + Convert.ToString(listBox1.SelectedValue) + ".ccb");
            VanCo.DangChoi = true;
            this.Close();
        }       
    }
}